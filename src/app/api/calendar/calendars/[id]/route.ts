import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const isEnabled = typeof body.is_enabled === 'boolean' ? body.is_enabled : null

  if (isEnabled === null) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { data: calendar } = await supabase
    .from('calendar_calendars')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!calendar) {
    return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('calendar_calendars')
    .update({ is_enabled: isEnabled })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 200 })
}
