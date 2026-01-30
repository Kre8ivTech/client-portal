import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTicketSchema } from '@/lib/validators/ticket'
import { createNotifications } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = createTicketSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        organization_id: profile.organization_id,
        created_by: user.id,
        subject: result.data.subject,
        description: result.data.description,
        priority: result.data.priority,
        category: result.data.category,
        status: 'new',
        tags: [],
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    try {
      await createNotifications({
        organizationId: profile.organization_id,
        recipientIds: [user.id],
        createdBy: user.id,
        title: `Ticket created: ${ticket.subject}`,
        body: 'Your ticket has been created and added to the queue.',
        type: 'ticket.created',
        metadata: { ticket_id: ticket.id },
      })
    } catch {
      // Ignore notification failures
    }

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
