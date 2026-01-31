import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const allowedRoles = new Set(['staff', 'super_admin'])

export async function DELETE(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role || !allowedRoles.has(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: integration } = await supabase
    .from('calendar_integrations')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', params.provider)
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
  }

  const { data: calendars } = await supabase
    .from('calendar_calendars')
    .select('id')
    .eq('integration_id', integration.id)

  const calendarIds = (calendars || []).map((calendar) => calendar.id)

  if (calendarIds.length > 0) {
    await supabase.from('calendar_events').delete().in('calendar_id', calendarIds)
  }

  await supabase.from('calendar_calendars').delete().eq('integration_id', integration.id)

  await supabase
    .from('calendar_integrations')
    .update({
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      status: 'revoked',
      last_synced_at: null,
      error_message: null,
    })
    .eq('id', integration.id)

  return NextResponse.json({ data: { provider: params.provider } }, { status: 200 })
}
