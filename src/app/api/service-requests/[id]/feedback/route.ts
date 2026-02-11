import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { clientFeedbackSchema } from '@/lib/validators/service'

/**
 * POST /api/service-requests/[id]/feedback
 *
 * Allows clients to approve or provide feedback on an admin's response.
 * - If is_approval = true, the request status becomes 'approved'
 * - If is_approval = false, the request status remains 'responded' (awaiting admin re-response)
 *
 * Auth: Required (request owner only)
 * Body: { response_text: string, is_approval: boolean }
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

    // Parse and validate request body
    const body = await request.json()
    const result = clientFeedbackSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    // Fetch the service request to verify ownership and status
    const { data: serviceRequest, error: fetchError } = await supabase
      .from('service_requests')
      .select('id, organization_id, status, requested_by')
      .eq('id', id)
      .single()

    if (fetchError || !serviceRequest) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    // Verify user is the requester
    if (serviceRequest.requested_by !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only respond to your own service requests' },
        { status: 403 }
      )
    }

    // Can only provide feedback on 'responded' requests
    // (or 'pending' if admin hasn't responded yet, but we'll be strict)
    if (serviceRequest.status !== 'responded') {
      return NextResponse.json(
        {
          error: `Cannot provide feedback on ${serviceRequest.status} request. Wait for admin response.`,
        },
        { status: 400 }
      )
    }

    // Create the client feedback response
    const { data: response, error: insertError } = await supabase
      .from('service_request_responses')
      .insert({
        service_request_id: id,
        responder_id: user.id,
        response_type: 'client_feedback',
        response_text: result.data.response_text,
        is_approval: result.data.is_approval,
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
      console.error('Error creating client feedback:', insertError)
      return NextResponse.json(
        { error: 'Failed to create feedback', details: insertError?.message },
        { status: 500 }
      )
    }

    // The trigger will automatically:
    // - Update service_request status to 'approved' if is_approval = true
    // - Keep status as 'responded' if is_approval = false (more feedback needed)
    // - Update latest_response_at, latest_response_by, response_count

    // Fetch updated service request
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

    // TODO: Send notification to admin about client feedback
    // if (!result.data.is_approval) {
    //   await notifyAdminOfClientFeedback(serviceRequest.organization_id, id)
    // }

    const message = result.data.is_approval
      ? 'Service request approved successfully'
      : 'Feedback submitted successfully'

    return NextResponse.json(
      {
        message,
        data: {
          response,
          service_request: updatedRequest,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error in POST /api/service-requests/[id]/feedback:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
