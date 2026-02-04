'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  revalidatePath(`/dashboard/service/${requestId}`)
  revalidatePath('/dashboard/service')
  return { success: true }
}
