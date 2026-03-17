'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function cancelServiceRequest(requestId: string) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Fetch the request to verify ownership/permission
  const { data: request, error: fetchError } = await supabase
    .from('service_requests')
    .select('requested_by, status')
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    return { error: 'Request not found' }
  }

  // Only allow cancellation if status is pending
  if (request.status !== 'pending') {
    return { error: 'Only pending requests can be cancelled' }
  }

  // Verify user is the requester (or admin, but for now let's say requester)
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isRequester = request.requested_by === user.id
  const isSuperAdmin = profile?.role === 'super_admin'

  if (!isRequester && !isSuperAdmin) {
    return { error: 'You do not have permission to cancel this request' }
  }

  const { error: updateError } = await supabase
    .from('service_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Notify assigned staff about cancellation
  try {
    const admin = getSupabaseAdmin()
    const { data: staffAssignments } = await (admin as any)
      .from('staff_assignments')
      .select('staff_user:users!staff_assignments_staff_user_id_fkey(email, full_name)')
      .eq('assignable_type', 'service_request')
      .eq('assignable_id', requestId)
      .is('unassigned_at', null)

    for (const assignment of staffAssignments || []) {
      if (!assignment.staff_user?.email) continue
      sendTemplatedEmail({
        to: assignment.staff_user.email,
        templateType: 'service_request_cancelled' as any,
        variables: {
          recipient_name: assignment.staff_user.full_name || assignment.staff_user.email,
          request_number: '',
          service_request_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'}/dashboard/admin/service-requests`,
          app_url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app',
          current_year: new Date().getFullYear().toString(),
        },
      }).catch(() => {})
    }
  } catch {
    // Notification is best-effort
  }

  revalidatePath(`/dashboard/service/${requestId}`)
  revalidatePath('/dashboard/service')
  return { success: true }
}
