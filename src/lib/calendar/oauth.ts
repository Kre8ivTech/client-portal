/**
 * Calendar OAuth Service
 * Handles OAuth flows for Google and Microsoft calendar integrations
 */

import { CALENDAR_PROVIDERS } from '@/types/calendar'
import type { 
  CalendarProvider, 
  OAuthState, 
  OAuthTokens,
} from '@/types/calendar'

// =============================================================================
// OAUTH URL GENERATION
// =============================================================================

/**
 * Generate the OAuth authorization URL for a provider
 */
export function getAuthorizationUrl(
  provider: CalendarProvider,
  profileId: string,
  redirectUri: string
): { url: string; state: string } {
  const config = CALENDAR_PROVIDERS[provider]
  
  // Create state for CSRF protection
  const state: OAuthState = {
    provider,
    profile_id: profileId,
    redirect_url: redirectUri,
    nonce: generateNonce(),
    expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
  }
  
  const stateString = Buffer.from(JSON.stringify(state)).toString('base64url')
  
  const params = new URLSearchParams({
    client_id: getClientId(provider),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state: stateString,
    access_type: 'offline', // Google: get refresh token
    prompt: 'consent', // Force consent to always get refresh token
  })

  // Microsoft-specific params
  if (provider === 'microsoft') {
    params.set('response_mode', 'query')
  }

  return {
    url: `${config.authUrl}?${params.toString()}`,
    state: stateString,
  }
}

/**
 * Validate OAuth state from callback
 */
export function validateState(stateString: string): OAuthState | null {
  try {
    const state = JSON.parse(
      Buffer.from(stateString, 'base64url').toString()
    ) as OAuthState
    
    // Check expiration
    if (state.expires_at < Date.now()) {
      console.error('OAuth state expired')
      return null
    }
    
    return state
  } catch (error) {
    console.error('Failed to parse OAuth state:', error)
    return null
  }
}

// =============================================================================
// TOKEN EXCHANGE
// =============================================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: CalendarProvider,
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const config = CALENDAR_PROVIDERS[provider]
  
  const params = new URLSearchParams({
    client_id: getClientId(provider),
    client_secret: getClientSecret(provider),
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await response.json()
  
  return normalizeTokenResponse(provider, data)
}

/**
 * Refresh an access token
 */
export async function refreshAccessToken(
  provider: CalendarProvider,
  refreshToken: string
): Promise<OAuthTokens> {
  const config = CALENDAR_PROVIDERS[provider]
  
  const params = new URLSearchParams({
    client_id: getClientId(provider),
    client_secret: getClientSecret(provider),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const data = await response.json()
  
  // Keep the original refresh token if a new one isn't provided
  const tokens = normalizeTokenResponse(provider, data)
  if (!tokens.refresh_token) {
    tokens.refresh_token = refreshToken
  }
  
  return tokens
}

/**
 * Revoke tokens (disconnect)
 */
export async function revokeTokens(
  provider: CalendarProvider,
  accessToken: string
): Promise<boolean> {
  try {
    if (provider === 'google') {
      const response = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${accessToken}`,
        { method: 'POST' }
      )
      return response.ok
    }
    
    // Microsoft doesn't have a simple revoke endpoint
    // The token will naturally expire
    return true
  } catch (error) {
    console.error('Failed to revoke tokens:', error)
    return false
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function normalizeTokenResponse(
  provider: CalendarProvider,
  data: Record<string, unknown>
): OAuthTokens {
  const expiresIn = (data.expires_in as number) || 3600
  
  return {
    access_token: data.access_token as string,
    refresh_token: (data.refresh_token as string) || null,
    expires_at: Date.now() + expiresIn * 1000,
    token_type: (data.token_type as string) || 'Bearer',
    scopes: typeof data.scope === 'string' 
      ? (data.scope as string).split(' ')
      : CALENDAR_PROVIDERS[provider].scopes,
  }
}

function getClientId(provider: CalendarProvider): string {
  const envKey = provider === 'google' 
    ? 'GOOGLE_CLIENT_ID' 
    : 'MICROSOFT_CLIENT_ID'
  
  const clientId = process.env[envKey]
  if (!clientId) {
    throw new Error(`Missing ${envKey} environment variable`)
  }
  return clientId
}

function getClientSecret(provider: CalendarProvider): string {
  const envKey = provider === 'google' 
    ? 'GOOGLE_CLIENT_SECRET' 
    : 'MICROSOFT_CLIENT_SECRET'
  
  const secret = process.env[envKey]
  if (!secret) {
    throw new Error(`Missing ${envKey} environment variable`)
  }
  return secret
}

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

// =============================================================================
// USER INFO
// =============================================================================

/**
 * Get user info from provider (email, account ID)
 */
export async function getUserInfo(
  provider: CalendarProvider,
  accessToken: string
): Promise<{ email: string; id: string; name?: string }> {
  if (provider === 'google') {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    
    if (!response.ok) {
      throw new Error('Failed to get Google user info')
    }
    
    const data = await response.json()
    return {
      email: data.email,
      id: data.id,
      name: data.name,
    }
  }
  
  // Microsoft
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  
  if (!response.ok) {
    throw new Error('Failed to get Microsoft user info')
  }
  
  const data = await response.json()
  return {
    email: data.mail || data.userPrincipalName,
    id: data.id,
    name: data.displayName,
  }
}
