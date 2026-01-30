import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTicketCommentSchema } from '@/lib/validators/ticket'
import { createNotifications } from '@/lib/notifications'

const internalCommentRoles = new Set(['staff', 'super_admin', 'partner', 'partner_staff'])

export async function POST(
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
    const result = createTicketCommentSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.role) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
    }

    const isInternal = result.data.is_internal ?? false
    if (isInternal && !internalCommentRoles.has(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, created_by, assigned_to, subject, organization_id')
      .eq('id', params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const { data: comment, error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: params.id,
        author_id: user.id,
        content: result.data.content,
        is_internal: isInternal,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const recipients = [ticket.created_by, ticket.assigned_to].filter(
      (recipient) => recipient && recipient !== user.id
    ) as string[]

    if (recipients.length > 0) {
      try {
        await createNotifications({
          organizationId: ticket.organization_id,
          recipientIds: recipients,
          createdBy: user.id,
          title: `New comment on ticket: ${ticket.subject}`,
          body: isInternal
            ? 'An internal note was added to the ticket.'
            : 'A new comment was added to the ticket.',
          type: 'ticket.comment',
          metadata: { ticket_id: ticket.id, comment_id: comment.id },
        })
      } catch {
        // Ignore notification failures
      }
    }

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
