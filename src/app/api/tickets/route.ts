import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTicketSchema } from '@/lib/validators/ticket'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createTicketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  const organizationId = userRow?.organization_id ?? null
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization is required to create a ticket' }, { status: 400 })
  }

  const { data: ticket, error: insertError } = await supabase
    .from('tickets')
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      subject: parsed.data.subject,
      description: parsed.data.description,
      priority: parsed.data.priority,
      category: parsed.data.category,
      status: 'new',
      tags: [],
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ data: ticket }, { status: 201 })
}

