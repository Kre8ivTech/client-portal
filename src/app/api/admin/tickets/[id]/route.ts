import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeAuditLog } from '@/lib/audit'
import { normalizeDashboardRole } from '@/lib/require-role'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type UserAuthRow = {
  role: string
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ticketId = z.string().uuid().safeParse(id)

    if (!ticketId.success) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (normalizeDashboardRole((profile as UserAuthRow).role) !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, ticket_number, subject, status, organization_id')
      .eq('id', ticketId.data)
      .maybeSingle()

    if (ticketError) {
      console.error('Failed to load ticket for deletion:', ticketError)
      return NextResponse.json({ error: 'Failed to load ticket' }, { status: 500 })
    }

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const { data: deletedTicket, error: deleteError } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticketId.data)
      .select('id')
      .maybeSingle()

    if (deleteError) {
      console.error('Failed to delete ticket:', deleteError)
      return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 })
    }

    if (!deletedTicket) {
      return NextResponse.json({ error: 'Ticket could not be deleted' }, { status: 409 })
    }

    await writeAuditLog({
      action: 'ticket_deleted',
      entity_type: 'ticket',
      entity_id: deletedTicket.id,
      old_values: {
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        organization_id: ticket.organization_id,
      },
    })

    return NextResponse.json({ success: true, deletedId: deletedTicket.id })
  } catch (error) {
    console.error('Ticket DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
