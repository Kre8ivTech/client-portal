import crypto from 'crypto'

function getOAuthStateSecret(): string {
  const explicit = process.env.OAUTH_STATE_SECRET?.trim()
  if (explicit) {
    return explicit
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'OAUTH_STATE_SECRET must be set in production for OAuth state signing (do not use SUPABASE_SERVICE_ROLE_KEY).'
    )
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'local-dev-oauth-state-only'
}

export function createSignedOAuthState(data: Record<string, unknown>): string {
  const secret = getOAuthStateSecret()
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifySignedOAuthState(state: string): Record<string, unknown> | null {
  let secret: string
  try {
    secret = getOAuthStateSecret()
  } catch {
    return null
  }

  try {
    const parts = state.split('.')
    if (parts.length !== 2) return null

    const [payload, signature] = parts
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
    const signatureBuffer = Buffer.from(signature, 'utf8')
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8')
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded) ? decoded : null
  } catch {
    return null
  }
}

export function sanitizeOAuthReturnPath(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') return '/dashboard/integrations'
  const pathname = path.split('?')[0]
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) {
    return '/dashboard/settings'
  }
  if (
    pathname === '/dashboard/integrations' ||
    pathname.startsWith('/dashboard/integrations/')
  ) {
    return '/dashboard/integrations'
  }
  return '/dashboard/integrations'
}
