import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { adminResponseSchema } from '@/lib/validators/service'

/**
 * POST /api/service-requests/[id]/respond
 *
 * Allows admin/staff to respond to a service request with details.
 * This creates an admin response and updates the service request status to 'responded'.
 *
 * Auth: Required (staff/admin only)
 * Body: { response_text: string, response_metadata?: Record<string, any> }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile and check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Verify user is staff/admin
    if (!['super_admin', 'staff', 'partner'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only staff can respond to service requests' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = adminResponseSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    // Fetch the service request to verify it exists and belongs to accessible org
    const { data: serviceRequest, error: fetchError } = await supabase
      .from('service_requests')
      .select('id, organization_id, status, requested_by')
      .eq('id', id)
      .single()

    if (fetchError || !serviceRequest) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    // Verify admin can access this organization's requests
    // Super admins can access all, staff can access their own org
    if (profile.role !== 'super_admin' && serviceRequest.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot respond to requests from other organizations' },
        { status: 403 }
      )
    }

    // Prevent responding to already approved/rejected/cancelled requests
    if (['approved', 'rejected', 'cancelled', 'converted'].includes(serviceRequest.status)) {
      return NextResponse.json(
        { error: `Cannot respond to ${serviceRequest.status} request` },
        { status: 400 }
      )
    }

    // Create the admin response
    const { data: response, error: insertError } = await supabase
      .from('service_request_responses')
      .insert({
        service_request_id: id,
        responder_id: user.id,
        response_type: 'admin_response',
        response_text: result.data.response_text,
        response_metadata: result.data.response_metadata || {},
      })
      .select(
        `
        *,
        responder:profiles!responder_id(
          id,
          name,
          email,
          avatar_url
        )
      `
      )
      .single()

    if (insertError || !response) {
      console.error('Error creating admin response:', insertError)
      return NextResponse.json(
        { error: 'Failed to create response', details: insertError?.message },
        { status: 500 }
      )
    }

    // The trigger will automatically update the service_request status to 'responded'
    // and update latest_response_at, latest_response_by, response_count

    // Fetch updated service request with all responses
    const { data: updatedRequest, error: updateFetchError } = await supabase
      .from('service_requests')
      .select(
        `
        *,
        service:services!service_id(id, name, category),
        requester:profiles!requested_by(id, name, email)
      `
      )
      .eq('id', id)
      .single()

    if (updateFetchError) {
      console.error('Error fetching updated request:', updateFetchError)
    }

    // TODO: Send notification to client about new response
    // await notifyClientOfResponse(serviceRequest.requested_by, id)

    return NextResponse.json(
      {
        message: 'Response created successfully',
        data: {
          response,
          service_request: updatedRequest,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error in POST /api/service-requests/[id]/respond:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
