import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { syncUserIntegrations } from '@/lib/calendar/sync'

const allowedRoles = new Set(['staff', 'super_admin'])

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}))
  const provider = typeof body.provider === 'string' ? body.provider : undefined

  const results = await syncUserIntegrations(user.id, provider)
  return NextResponse.json({ data: results }, { status: 200 })
}
