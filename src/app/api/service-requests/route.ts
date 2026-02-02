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

    const p = profile as { organization_id: string | null; role: string }

    // Build query based on role
    let query = (supabase as any)
      .from('service_requests')
      .select(`
        *,
        service:services(id, name, description, category, base_rate, rate_type),
        requester:users!requested_by(id, email, profiles(name, avatar_url))
      `)
    
    if (p.organization_id) {
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

    // Get user's organization
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null }
    if (!p.organization_id) {
      return NextResponse.json(
        { error: 'No organization associated with your account' },
        { status: 400 }
      )
    }

    // Allow requesting services offered by the user's org OR their parent org
    const { data: orgRow } = await (supabase as any)
      .from('organizations')
      .select('parent_org_id')
      .eq('id', p.organization_id)
      .single()

    const parentOrgId = (orgRow as { parent_org_id: string | null } | null)?.parent_org_id ?? null
    const allowedServiceOrgIds = new Set([p.organization_id, parentOrgId].filter(Boolean) as string[])

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
    const { data: service, error: serviceError } = await (supabase as any)
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

    const serviceData = service as { id: string; is_active: boolean; organization_id: string | null }
    if (!serviceData.organization_id || !allowedServiceOrgIds.has(serviceData.organization_id)) {
      return NextResponse.json({ error: 'Service not available for your organization' }, { status: 403 })
    }

    // Create service request
    const { data: serviceRequest, error } = await (supabase as any)
      .from('service_requests')
      .insert({
        ...result.data,
        organization_id: p.organization_id,
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
