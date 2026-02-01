import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/contracts/[id]/audit-log
 * Get audit trail for a contract
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

    // Get user info
    const { data: userRow } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // First verify the contract exists and user has access to it - RLS will handle this
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, organization_id')
      .eq('id', id)
      .single()

    if (contractError) {
      if (contractError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
      }
      console.error('Error fetching contract:', contractError)
      return NextResponse.json({ error: contractError.message }, { status: 500 })
    }

    // Get audit logs for this contract
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        created_at,
        old_values,
        new_values,
        details,
        user:users(
          id,
          full_name,
          email
        )
      `)
      .eq('entity_type', 'contract')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })

    if (auditError) {
      console.error('Error fetching audit logs:', auditError)
      return NextResponse.json({ error: auditError.message }, { status: 500 })
    }

    // Transform audit logs to a more readable format
    const formattedLogs = auditLogs.map((log: any) => ({
      id: log.id,
      action: log.action,
      timestamp: log.created_at,
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.full_name,
            email: log.user.email,
          }
        : null,
      changes: {
        old: log.old_values,
        new: log.new_values,
      },
      details: log.details,
    }))

    return NextResponse.json({
      data: formattedLogs,
      meta: {
        contract_id: id,
        total: formattedLogs.length,
      },
    })
  } catch (err) {
    console.error('Error fetching audit logs:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
