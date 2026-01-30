type MicrosoftTokens = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

export function buildMicrosoftAuthUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string
  redirectUri: string
  state: string
}) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: ['offline_access', 'Calendars.Read', 'User.Read'].join(' '),
    state,
  })

  return `${MICROSOFT_AUTH_URL}?${params.toString()}`
}

export async function exchangeMicrosoftCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
}: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}) {
  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to exchange Microsoft authorization code.')
  }

  return (await response.json()) as MicrosoftTokens
}

export async function refreshMicrosoftToken({
  refreshToken,
  clientId,
  clientSecret,
  redirectUri,
}: {
  refreshToken: string
  clientId: string
  clientSecret: string
  redirectUri: string
}) {
  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Microsoft access token.')
  }

  return (await response.json()) as MicrosoftTokens
}

export async function fetchMicrosoftProfile(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) return null

  return response.json() as Promise<{ mail?: string; userPrincipalName?: string }>
}

export async function fetchMicrosoftCalendars(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Microsoft calendars.')
  }

  const payload = await response.json()
  return payload.value || []
}

export async function fetchMicrosoftEvents({
  accessToken,
  calendarId,
  timeMin,
  timeMax,
}: {
  accessToken: string
  calendarId: string
  timeMin: string
  timeMax: string
}) {
  const params = new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
  })

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    throw new Error('Failed to fetch Microsoft calendar events.')
  }

  const payload = await response.json()
  return payload.value || []
}
