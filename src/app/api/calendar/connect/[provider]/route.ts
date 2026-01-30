import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { buildGoogleAuthUrl } from '@/lib/calendar/providers/google'
import { buildMicrosoftAuthUrl } from '@/lib/calendar/providers/microsoft'

const allowedRoles = new Set(['staff', 'super_admin'])

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role || !allowedRoles.has(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const provider = params.provider
  const state = crypto.randomUUID()
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback/${provider}`
    : `${request.nextUrl.origin}/api/calendar/callback/${provider}`

  let authUrl: string | null = null

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 400 })
    }
    authUrl = buildGoogleAuthUrl({ clientId, redirectUri, state })
  } else if (provider === 'microsoft') {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Microsoft OAuth not configured' }, { status: 400 })
    }
    authUrl = buildMicrosoftAuthUrl({ clientId, redirectUri, state })
  }

  if (!authUrl) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
  }

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('calendar_oauth_state', state, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 600,
  })
  response.cookies.set('calendar_oauth_user', user.id, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 600,
  })

  return response
}
