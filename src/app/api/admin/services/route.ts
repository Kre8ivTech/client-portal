import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { serviceSchema } from '@/lib/validators/service'

function isMissingColumnSchemaCacheError(message: string | undefined, column: string) {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes('schema cache') &&
    (m.includes(`'${column.toLowerCase()}'`) || m.includes(`"${column.toLowerCase()}"`))
  )
}

// GET /api/admin/services - List all services
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

    // Get user's org and role
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string }
    if (!['super_admin', 'staff'].includes(p.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const active = searchParams.get('active')

    // Build query
    let query = (supabase as any)
      .from('services')
      .select('*, created_by_user:users!created_by(id, profiles(name))')
    
    // Staff are scoped to their own org. Super admins can view across orgs.
    if (p.role !== 'super_admin' && p.organization_id) {
      query = query.eq('organization_id', p.organization_id)
    }
    
    query = query
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }
    if (active === 'true') {
      query = query.eq('is_active', true)
    } else if (active === 'false') {
      query = query.eq('is_active', false)
    }

    const { data: services, error } = await query

    if (error) {
      console.error('Error fetching services:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: services }, { status: 200 })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/services - Create new service
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

    // Get user's org and role
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string }
    if (!['super_admin', 'staff'].includes(p.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const result = serviceSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const requestedOrgId = (result.data as any).organization_id as string | undefined
    const targetOrgId =
      p.role === 'super_admin'
        ? (requestedOrgId || p.organization_id)
        : p.organization_id

    if (!targetOrgId) {
      return NextResponse.json(
        { error: 'Missing organization context for service creation' },
        { status: 400 }
      )
    }

    // Non-super-admins cannot override organization_id
    const insertData: any = {
      ...result.data,
      organization_id: targetOrgId,
      created_by: user.id,
    }
    if (p.role !== 'super_admin') {
      delete insertData.organization_id
      insertData.organization_id = targetOrgId
    }

    // Insert service
    let service: any = null
    let error: any = null

    ;({ data: service, error } = await (supabase as any)
      .from('services')
      .insert(insertData)
      .select()
      .single())

    // Backwards-compat: if DB schema doesn't have is_global yet, retry without it.
    if (error && isMissingColumnSchemaCacheError(error.message, 'is_global')) {
      const retryData = { ...insertData }
      delete retryData.is_global
      ;({ data: service, error } = await (supabase as any)
        .from('services')
        .insert(retryData)
        .select()
        .single())
    }

    if (error) {
      console.error('Error creating service:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: service }, { status: 201 })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
