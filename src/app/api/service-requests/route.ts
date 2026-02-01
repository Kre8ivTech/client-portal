import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { serviceRequestSchema } from '@/lib/validators/service'

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

    // Build query based on role
    let query = supabase
      .from('service_requests')
      .select(`
        *,
        service:services(id, name, description, category, base_rate, rate_type),
        requester:users!requested_by(id, email, profiles(name, avatar_url))
      `)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })

    // Clients can only see their own requests
    if (profile.role === 'client') {
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

    // Get user's organization
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Validate input
    const body = await request.json()
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
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, is_active, organization_id')
      .eq('id', result.data.service_id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (!service.is_active) {
      return NextResponse.json({ error: 'Service is not available' }, { status: 400 })
    }

    if (service.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Service not available for your organization' }, { status: 403 })
    }

    // Create service request
    const { data: serviceRequest, error } = await supabase
      .from('service_requests')
      .insert({
        ...result.data,
        organization_id: profile.organization_id,
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

    return NextResponse.json({ data: serviceRequest }, { status: 201 })
  } catch (err) {
    console.error('Service request POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
