import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/calendar/secrets'
import { exchangeGoogleCode, fetchGoogleProfile } from '@/lib/calendar/providers/google'
import { exchangeMicrosoftCode, fetchMicrosoftProfile } from '@/lib/calendar/providers/microsoft'

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
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id || !allowedRoles.has(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  const storedState = request.cookies.get('calendar_oauth_state')?.value
  const storedUser = request.cookies.get('calendar_oauth_user')?.value

  if (!state || !code || state !== storedState || storedUser !== user.id) {
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 })
  }

  const provider = params.provider
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback/${provider}`
    : `${request.nextUrl.origin}/api/calendar/callback/${provider}`

  let tokens: { access_token: string; refresh_token?: string; expires_in?: number }
  let accountEmail: string | null = null

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 400 })
    }

    tokens = await exchangeGoogleCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    const profileInfo = await fetchGoogleProfile(tokens.access_token)
    accountEmail = profileInfo?.email || null
  } else if (provider === 'microsoft') {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Microsoft OAuth not configured' }, { status: 400 })
    }

    tokens = await exchangeMicrosoftCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    const profileInfo = await fetchMicrosoftProfile(tokens.access_token)
    accountEmail = profileInfo?.mail || profileInfo?.userPrincipalName || null
  } else {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  await supabase
    .from('calendar_integrations')
    .upsert({
      organization_id: profile.organization_id,
      user_id: user.id,
      provider,
      account_email: accountEmail,
      access_token_encrypted: encryptSecret(tokens.access_token),
      refresh_token_encrypted: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token)
        : null,
      token_expires_at: expiresAt,
      scope: null,
      status: 'active',
      last_synced_at: null,
      error_message: null,
    })
    .select()
    .single()

  const response = NextResponse.redirect(new URL('/dashboard/profile', request.url))
  response.cookies.delete('calendar_oauth_state')
  response.cookies.delete('calendar_oauth_user')
  return response
}
