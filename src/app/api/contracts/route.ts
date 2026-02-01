import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { contractCreateSchema } from '@/lib/validators/contract'
import { writeAuditLog } from '@/lib/audit'

/**
 * GET /api/contracts
 * List contracts with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info
    const { data: userRow } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const status = searchParams.get('status')
    const contract_type = searchParams.get('contract_type')
    const client_id = searchParams.get('client_id')

    // Validate pagination
    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    const offset = (page - 1) * limit

    // Build query - RLS handles organization filtering
    let query = supabase
      .from('contracts')
      .select(`
        *,
        client:users!contracts_client_id_fkey(
          id,
          full_name,
          email
        ),
        creator:users!contracts_created_by_fkey(
          id,
          full_name,
          email
        ),
        template:contract_templates(
          id,
          name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (contract_type) {
      query = query.eq('contract_type', contract_type)
    }
    if (client_id) {
      query = query.eq('client_id', client_id)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: contracts, error, count } = await query

    if (error) {
      console.error('Error listing contracts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: contracts,
      meta: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    })
  } catch (err) {
    console.error('Error listing contracts:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/contracts
 * Create a new contract
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info
    const { data: userRow } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const organizationId = userRow.organization_id

    if (!organizationId) {
      return NextResponse.json(
        { error: 'User must belong to an organization' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = contractCreateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data

    // Verify client belongs to same organization
    const { data: clientUser, error: clientError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', input.client_id)
      .single()

    if (clientError || !clientUser) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    if (clientUser.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Client must belong to same organization' },
        { status: 403 }
      )
    }

    // If template_id provided, fetch and render template
    let content_html = null
    let content_data = input.metadata || {}

    if (input.template_id) {
      const { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('id', input.template_id)
        .single()

      if (templateError || !template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }

      // Basic template rendering - replace {{variable}} with values
      content_html = template.content
      if (content_html && content_data) {
        Object.entries(content_data).forEach(([key, value]) => {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
          content_html = content_html!.replace(regex, String(value))
        })
      }
    }

    // Create the contract
    const { data: contract, error: createError } = await supabase
      .from('contracts')
      .insert({
        title: input.title,
        description: input.description,
        contract_type: input.contract_type,
        client_id: input.client_id,
        template_id: input.template_id || null,
        expires_at: input.expires_at || null,
        metadata: content_data,
        content_html,
        status: 'draft',
        created_by: user.id,
        organization_id: organizationId,
      })
      .select(`
        *,
        client:users!contracts_client_id_fkey(
          id,
          full_name,
          email
        ),
        creator:users!contracts_created_by_fkey(
          id,
          full_name,
          email
        ),
        template:contract_templates(
          id,
          name
        )
      `)
      .single()

    if (createError) {
      console.error('Error creating contract:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.created',
      entity_type: 'contract',
      entity_id: contract.id,
      new_values: contract,
      details: {
        contract_type: input.contract_type,
        client_id: input.client_id,
      },
    })

    return NextResponse.json({ data: contract }, { status: 201 })
  } catch (err) {
    console.error('Error creating contract:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
