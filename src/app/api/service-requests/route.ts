import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { serviceRequestSchema } from '@/lib/validators/service'
import { notifyServiceRequestCreated } from '@/lib/actions/task-notifications'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string }
    const isStaffOrAdmin = ['super_admin', 'staff'].includes(p.role)

    // Build query based on role
    let query = (supabase as any)
      .from('service_requests')
      .select(`
        *,
        service:services(id, name, description, category, base_rate, rate_type),
        requester:users!requested_by(id, email, profiles(name, avatar_url)),
        organization:organizations(id, name)
      `)
    
    // Staff/Admin can see ALL requests, clients only see their organization's
    if (!isStaffOrAdmin && p.organization_id) {
      query = query.eq('organization_id', p.organization_id)
    }
    
    query = query.order('created_at', { ascending: false })

    // Clients can only see their own requests
    if (p.role === 'client') {
      query = query.eq('requested_by', user.id)
    }

    const { data: requests, error } = await query

    if (error) {
      console.error('Failed to fetch service requests:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: requests })
  } catch (err) {
    console.error('Service requests GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization and role
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string }
    const isStaffOrAdmin = ['super_admin', 'staff'].includes(p.role)

    // Validate input first to get the body
    const body = await request.json()

    // Determine the organization_id to use
    let targetOrganizationId: string | null = p.organization_id

    // Staff/Admin can specify a different organization
    if (isStaffOrAdmin && body.organization_id) {
      // Verify the organization exists
      const { data: targetOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', body.organization_id)
        .single()
      
      if (!targetOrg) {
        return NextResponse.json({ error: 'Specified organization not found' }, { status: 404 })
      }
      targetOrganizationId = body.organization_id
    }

    // For non-staff users, require an organization
    if (!isStaffOrAdmin && !targetOrganizationId) {
      return NextResponse.json(
        { error: 'No organization associated with your account' },
        { status: 400 }
      )
    }

    // For staff/admin creating requests, require an organization to be selected
    if (isStaffOrAdmin && !targetOrganizationId) {
      return NextResponse.json(
        { error: 'Please select an organization for this service request' },
        { status: 400 }
      )
    }
    const result = serviceRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten(),
        },
        { status: 400 }
      )
    }

    // Verify service exists and is active
    const { data: service, error: serviceError } = await (supabase as any)
      .from('services')
      .select('id, is_active')
      .eq('id', result.data.service_id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (!service.is_active) {
      return NextResponse.json({ error: 'Service is not available' }, { status: 400 })
    }

    // Create service request
    const { data: serviceRequest, error } = await (supabase as any)
      .from('service_requests')
      .insert({
        ...result.data,
        organization_id: targetOrganizationId,
        requested_by: user.id,
        status: 'pending',
      })
      .select(`
        *,
        service:services(id, name, description, category, base_rate, rate_type)
      `)
      .single()

    if (error) {
      console.error('Failed to create service request:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get client info for notification
    const { data: clientProfile } = await supabase
      .from('users')
      .select('profiles(name)')
      .eq('id', user.id)
      .single()

    const { data: organization } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', targetOrganizationId)
      .single()

    // Trigger notification to admin and assigned staff
    // This will create acknowledgement tokens and send emails
    notifyServiceRequestCreated(
      serviceRequest.id,
      serviceRequest.request_number || 'N/A',
      serviceRequest.service?.name || 'Service',
      (clientProfile as any)?.profiles?.name || user.email || 'Client',
      organization?.name || 'Organization',
      serviceRequest.priority || 'medium'
    ).catch((err) => {
      // Log error but don't fail the request
      console.error('Failed to send service request notifications:', err)
    })

    return NextResponse.json({ data: serviceRequest }, { status: 201 })
  } catch (err) {
    console.error('Service request POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
