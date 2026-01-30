import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateTicketStatusSchema } from '@/lib/validators/ticket'
import { createNotifications } from '@/lib/notifications'

const privilegedRoles = new Set(['staff', 'super_admin', 'partner', 'partner_staff'])
const statusTransitions: Record<string, string[]> = {
  new: ['open', 'in_progress', 'pending_client', 'resolved', 'closed'],
  open: ['in_progress', 'pending_client', 'resolved', 'closed'],
  in_progress: ['pending_client', 'resolved', 'closed'],
  pending_client: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'open', 'in_progress'],
  closed: [],
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = updateTicketStatusSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    if (!privilegedRoles.has(profile.role) && profile.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: currentTicket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, status, created_by, assigned_to, subject, organization_id')
      .eq('id', params.id)
      .single()

    if (ticketError || !currentTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (profile.role === 'client' && currentTicket.status === 'closed') {
      return NextResponse.json({ error: 'Ticket already closed' }, { status: 400 })
    }

    if (profile.role === 'client' && result.data.status !== 'closed') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (result.data.status !== currentTicket.status) {
      const allowed = statusTransitions[currentTicket.status] || []
      if (!allowed.includes(result.data.status)) {
        return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 })
      }
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .update({ status: result.data.status })
      .eq('id', params.id)
      .select()
      .single()

    if (error || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (result.data.status !== currentTicket.status) {
      const recipients = [currentTicket.created_by, currentTicket.assigned_to].filter(
        (recipient) => recipient && recipient !== user.id
      ) as string[]

      try {
        await createNotifications({
          organizationId: currentTicket.organization_id,
          recipientIds: recipients,
          createdBy: user.id,
          title: `Ticket status updated: ${currentTicket.subject}`,
          body: `Status changed to ${result.data.status.replace('_', ' ')}.`,
          type: 'ticket.status_updated',
          metadata: { ticket_id: currentTicket.id, status: result.data.status },
        })
      } catch {
        // Ignore notification failures
      }
    }

    return NextResponse.json({ data: ticket }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
