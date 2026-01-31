import { addDays, startOfDay } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { decryptSecret, encryptSecret } from '@/lib/calendar/secrets'
import {
  fetchGoogleCalendars,
  fetchGoogleEvents,
  fetchGoogleProfile,
  refreshGoogleToken,
} from '@/lib/calendar/providers/google'
import {
  fetchMicrosoftCalendars,
  fetchMicrosoftEvents,
  fetchMicrosoftProfile,
  refreshMicrosoftToken,
} from '@/lib/calendar/providers/microsoft'
import { upsertCapacitySnapshotForOrg } from '@/lib/calendar/capacity'

const LOOKAHEAD_DAYS = 30

type Integration = {
  id: string
  organization_id: string
  user_id: string
  provider: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  token_expires_at: string | null
}

export async function syncAllIntegrations() {
  const { data: integrations } = await supabaseAdmin
    .from('calendar_integrations')
    .select('id, organization_id')
    .eq('status', 'active')

  const results = {
    total: integrations?.length || 0,
    succeeded: 0,
    failed: 0,
  }

  const orgIds = new Set<string>()

  for (const integration of integrations || []) {
    orgIds.add(integration.organization_id)
    try {
      await syncIntegrationById(integration.id)
      results.succeeded += 1
    } catch (error) {
      results.failed += 1
    }
  }

  for (const orgId of orgIds) {
    try {
      await upsertCapacitySnapshotForOrg(orgId)
    } catch {
      // Ignore capacity snapshot failures
    }
  }

  return results
}

export async function syncUserIntegrations(userId: string, provider?: string) {
  const query = supabaseAdmin
    .from('calendar_integrations')
    .select('id, organization_id')
    .eq('status', 'active')
    .eq('user_id', userId)

  const { data: integrations } = provider ? await query.eq('provider', provider) : await query

  const results = {
    total: integrations?.length || 0,
    succeeded: 0,
    failed: 0,
  }

  const orgIds = new Set<string>()

  for (const integration of integrations || []) {
    orgIds.add(integration.organization_id)
    try {
      await syncIntegrationById(integration.id)
      results.succeeded += 1
    } catch {
      results.failed += 1
    }
  }

  for (const orgId of orgIds) {
    try {
      await upsertCapacitySnapshotForOrg(orgId)
    } catch {
      // Ignore capacity snapshot failures
    }
  }

  return results
}

export async function syncIntegrationById(integrationId: string) {
  const { data: integration } = await supabaseAdmin
    .from('calendar_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (!integration) {
    throw new Error('Integration not found.')
  }

  try {
    await syncIntegration(integration as Integration)
  } catch (error) {
    await markIntegrationError(
      integrationId,
      error instanceof Error ? error.message : 'Sync failed'
    )
    throw error
  }
}

async function syncIntegration(integration: Integration) {
  const accessToken = decryptSecret(integration.access_token_encrypted)
  const refreshToken = decryptSecret(integration.refresh_token_encrypted)

  if (!accessToken || !refreshToken) {
    throw new Error('Missing calendar tokens.')
  }

  const { accessToken: freshAccessToken, refreshToken: freshRefreshToken, expiresAt } =
    await ensureAccessToken(integration, accessToken, refreshToken)

  const { calendars, profileEmail } = await fetchProviderCalendars(
    integration.provider,
    freshAccessToken
  )

  if (profileEmail) {
    await supabaseAdmin
      .from('calendar_integrations')
      .update({ account_email: profileEmail })
      .eq('id', integration.id)
  }

  const calendarRecords = calendars.map((calendar: any) => ({
    organization_id: integration.organization_id,
    user_id: integration.user_id,
    integration_id: integration.id,
    external_id: calendar.id,
    name: calendar.summary || calendar.name || calendar.displayName || 'Calendar',
    time_zone: calendar.timeZone || calendar.timeZoneName || null,
    is_primary: Boolean(calendar.primary),
    is_enabled: true,
  }))

  const { data: storedCalendars } = await supabaseAdmin
    .from('calendar_calendars')
    .upsert(calendarRecords, { onConflict: 'integration_id,external_id' })
    .select('id, external_id, is_enabled')

  const calendarIdMap = new Map(
    (storedCalendars || []).map((calendar) => [calendar.external_id, calendar])
  )

  const rangeStart = startOfDay(new Date())
  const rangeEnd = addDays(rangeStart, LOOKAHEAD_DAYS)

  for (const calendar of calendars) {
    const stored = calendarIdMap.get(calendar.id)
    if (!stored || stored.is_enabled === false) continue

    const events = await fetchProviderEvents({
      provider: integration.provider,
      accessToken: freshAccessToken,
      calendarId: calendar.id,
      timeMin: rangeStart.toISOString(),
      timeMax: rangeEnd.toISOString(),
    })

    const eventRecords = events
      .map((event: any) => normalizeEvent(event, integration.provider))
      .filter((event) => Boolean(event.start_at && event.end_at))
      .map((event) => ({
        organization_id: integration.organization_id,
        user_id: integration.user_id,
        calendar_id: stored.id,
        external_id: event.external_id,
        title: event.title,
        start_at: event.start_at,
        end_at: event.end_at,
        is_busy: event.is_busy,
      }))

    if (eventRecords.length > 0) {
      await supabaseAdmin
        .from('calendar_events')
        .upsert(eventRecords, { onConflict: 'calendar_id,external_id' })
    }
  }

  await supabaseAdmin
    .from('calendar_integrations')
    .update({
      access_token_encrypted: encryptSecret(freshAccessToken),
      refresh_token_encrypted: encryptSecret(freshRefreshToken),
      token_expires_at: expiresAt?.toISOString() ?? null,
      last_synced_at: new Date().toISOString(),
      status: 'active',
      error_message: null,
    })
    .eq('id', integration.id)
}

async function ensureAccessToken(
  integration: Integration,
  accessToken: string,
  refreshToken: string
) {
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at)
    : null

  if (expiresAt && expiresAt.getTime() > Date.now() + 60 * 1000) {
    return { accessToken, refreshToken, expiresAt }
  }

  if (integration.provider === 'google') {
    const response = await refreshGoogleToken({
      refreshToken,
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    })

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || refreshToken,
      expiresAt: response.expires_in ? addSeconds(response.expires_in) : null,
    }
  }

  const response = await refreshMicrosoftToken({
    refreshToken,
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.MICROSOFT_OAUTH_REDIRECT_URI || '',
  })

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token || refreshToken,
    expiresAt: response.expires_in ? addSeconds(response.expires_in) : null,
  }
}

async function fetchProviderCalendars(provider: string, accessToken: string) {
  if (provider === 'google') {
    const [calendars, profile] = await Promise.all([
      fetchGoogleCalendars(accessToken),
      fetchGoogleProfile(accessToken),
    ])
    return { calendars, profileEmail: profile?.email }
  }

  const [calendars, profile] = await Promise.all([
    fetchMicrosoftCalendars(accessToken),
    fetchMicrosoftProfile(accessToken),
  ])

  return { calendars, profileEmail: profile?.mail || profile?.userPrincipalName }
}

async function fetchProviderEvents({
  provider,
  accessToken,
  calendarId,
  timeMin,
  timeMax,
}: {
  provider: string
  accessToken: string
  calendarId: string
  timeMin: string
  timeMax: string
}) {
  if (provider === 'google') {
    return fetchGoogleEvents({ accessToken, calendarId, timeMin, timeMax })
  }

  return fetchMicrosoftEvents({ accessToken, calendarId, timeMin, timeMax })
}

function normalizeEvent(event: any, provider: string) {
  if (provider === 'google') {
    const start = event.start?.dateTime || event.start?.date
    const end = event.end?.dateTime || event.end?.date
    return {
      external_id: event.id,
      title: event.summary || null,
      start_at: start || null,
      end_at: end || null,
      is_busy: event.transparency !== 'transparent',
    }
  }

  const start = event.start?.dateTime
  const end = event.end?.dateTime
  const showAs = event.showAs || 'busy'

  return {
    external_id: event.id,
    title: event.subject || null,
    start_at: start || null,
    end_at: end || null,
    is_busy: showAs !== 'free',
  }
}

async function markIntegrationError(integrationId: string, message: string) {
  await supabaseAdmin
    .from('calendar_integrations')
    .update({ status: 'error', error_message: message })
    .eq('id', integrationId)
}

function addSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000)
}
