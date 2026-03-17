import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { serviceRequestApprovalSchema } from '@/lib/validators/service'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/staff
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string }
    if (!['super_admin', 'staff', 'partner'].includes(p.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Validate input
    const body = await request.json()
    const result = serviceRequestApprovalSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten(),
        },
        { status: 400 }
      )
    }

    // Fetch the service request
    const { data: existingRequest, error: fetchError } = await (supabase as any)
      .from('service_requests')
      .select('id, organization_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    // Verify org access - super_admin can access all orgs
    const isSuperAdmin = p.role === 'super_admin'
    if (!isSuperAdmin && existingRequest.organization_id !== p.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if already processed
    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${existingRequest.status}` },
        { status: 400 }
      )
    }

    // Validate rejection reason
    if (result.data.status === 'rejected' && !result.data.rejection_reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting' },
        { status: 400 }
      )
    }

    // Update the service request
    const updateData: any = {
      status: result.data.status,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }

    if (result.data.rejection_reason) {
      updateData.rejection_reason = result.data.rejection_reason
    }

    if (result.data.internal_notes) {
      updateData.internal_notes = result.data.internal_notes
    }

    const { data: updatedRequest, error: updateError } = await (supabase as any)
      .from('service_requests')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        service:services(id, name, description, category, base_rate, rate_type),
        requester:users!requested_by(id, email, profiles(name))
      `)
      .single()

    if (updateError) {
      console.error('Failed to update service request:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Send email notification to the requester
    const isApproved = result.data.status === 'approved'
    const templateType = isApproved ? 'service_request_approved' : 'service_request_rejected'

    const { data: requester } = await (supabase as any)
      .from('users')
      .select('email, full_name')
      .eq('id', updatedRequest.requester?.id || '')
      .single()

    if (requester?.email) {
      sendTemplatedEmail({
        to: requester.email,
        templateType: templateType as any,
        variables: {
          recipient_name: requester.full_name || requester.email,
          request_number: updatedRequest.request_number || '',
          status: isApproved ? 'Approved' : 'Rejected',
          service_request_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'}/dashboard/service/${id}`,
          app_url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app',
          current_year: new Date().getFullYear().toString(),
        },
        organizationId: updatedRequest.organization_id,
      }).catch(() => {})
    }

    return NextResponse.json({ data: updatedRequest })
  } catch (err) {
    console.error('Service request approval error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
