import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { contractUpdateSchema } from '@/lib/validators/contract'
import { writeAuditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/contracts/[id]
 * Get contract details with signers and related info
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch contract with related data - RLS handles access control
    const { data: contract, error } = await supabase
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
          name,
          description
        ),
        signers:contract_signers(
          id,
          email,
          name,
          role,
          signing_order,
          status,
          signed_at
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
      }
      console.error('Error fetching contract:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: contract })
  } catch (err) {
    console.error('Error fetching contract:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/contracts/[id]
 * Update contract (only if status = 'draft')
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing contract
    const { data: existingContract, error: fetchError } = await (supabase as any)
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
      }
      console.error('Error fetching contract:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Check if contract is in draft status
    if (existingContract.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft contracts can be updated' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = contractUpdateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data

    // Re-render template if metadata changed and template exists
    let content_html = existingContract.content_html
    if (input.metadata && existingContract.template_id) {
      const { data: template } = await (supabase as any)
        .from('contract_templates')
        .select('content')
        .eq('id', existingContract.template_id)
        .single()

      if (template?.content) {
        content_html = template.content
        const mergedMetadata = { ...existingContract.metadata, ...input.metadata }
        Object.entries(mergedMetadata).forEach(([key, value]) => {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
          content_html = content_html!.replace(regex, String(value))
        })
      }
    }

    // Update the contract
    const updateData: any = {}
    if (input.title !== undefined) updateData.title = input.title
    if (input.description !== undefined) updateData.description = input.description
    if (input.expires_at !== undefined) updateData.expires_at = input.expires_at
    if (input.metadata !== undefined) {
      updateData.metadata = { ...existingContract.metadata, ...input.metadata }
    }
    if (content_html !== existingContract.content_html) {
      updateData.content_html = content_html
    }

    const { data: contract, error: updateError } = await (supabase as any)
      .from('contracts')
      .update(updateData)
      .eq('id', id)
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

    if (updateError) {
      console.error('Error updating contract:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.updated',
      entity_type: 'contract',
      entity_id: id,
      old_values: existingContract,
      new_values: contract,
      details: { updated_fields: Object.keys(updateData) },
    })

    return NextResponse.json({ data: contract })
  } catch (err) {
    console.error('Error updating contract:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/contracts/[id]
 * Cancel contract (set status = 'cancelled')
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing contract
    const { data: existingContract, error: fetchError } = await (supabase as any)
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
      }
      console.error('Error fetching contract:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Check if contract is already completed or cancelled
    if (['completed', 'cancelled'].includes(existingContract.status)) {
      return NextResponse.json(
        { error: `Contract is already ${existingContract.status}` },
        { status: 400 }
      )
    }

    // Cancel the contract
    const { data: contract, error: updateError } = await (supabase as any)
      .from('contracts')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error cancelling contract:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.cancelled',
      entity_type: 'contract',
      entity_id: id,
      old_values: { status: existingContract.status },
      new_values: { status: 'cancelled' },
    })

    return NextResponse.json({
      data: contract,
      message: 'Contract cancelled successfully',
    })
  } catch (err) {
    console.error('Error cancelling contract:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
