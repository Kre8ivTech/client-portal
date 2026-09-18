import type { NotificationResult } from '../index'

const CONFIG_KEYS = [
  'MICROSOFT_MAIL_TENANT_ID',
  'MICROSOFT_MAIL_CLIENT_ID',
  'MICROSOFT_MAIL_CLIENT_SECRET',
  'MICROSOFT_MAIL_SENDER',
] as const

export function hasMicrosoftMailConfiguration(): boolean {
  // Partial configuration must fail visibly rather than use another provider.
  return CONFIG_KEYS.some((key) => Boolean(process.env[key]))
}

/** Send through a dedicated, mailbox-scoped Exchange application identity. */
export async function sendWithMicrosoft(input: {
  to: string
  subject: string
  html: string
  replyTo?: string | null
}): Promise<NotificationResult> {
  const provider = 'microsoft365'
  if (CONFIG_KEYS.some((key) => !process.env[key])) {
    return { success: false, provider, error: 'Microsoft 365 mail configuration is incomplete' }
  }

  const tenantId = process.env.MICROSOFT_MAIL_TENANT_ID!
  const clientId = process.env.MICROSOFT_MAIL_CLIENT_ID!
  const sender = process.env.MICROSOFT_MAIL_SENDER!
  if (!/^[a-f0-9-]{36}$/i.test(tenantId) || !/^[a-f0-9-]{36}$/i.test(clientId)) {
    return { success: false, provider, error: 'Microsoft 365 mail application identifiers are invalid' }
  }

  try {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: process.env.MICROSOFT_MAIL_CLIENT_SECRET!,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default',
        }),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
        cache: 'no-store',
      },
    )
    if (!tokenResponse.ok) {
      return { success: false, provider, error: `Microsoft 365 authentication failed (HTTP ${tokenResponse.status})` }
    }
    const token: { access_token?: string } = await tokenResponse.json()
    if (!token.access_token) {
      return { success: false, provider, error: 'Microsoft 365 authentication returned no access token' }
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: input.subject,
            body: { contentType: 'HTML', content: input.html },
            from: { emailAddress: { address: sender, name: process.env.MICROSOFT_MAIL_FROM_NAME || 'Kre8ivTech' } },
            toRecipients: [{ emailAddress: { address: input.to } }],
            ...(input.replyTo ? { replyTo: [{ emailAddress: { address: input.replyTo } }] } : {}),
          },
          saveToSentItems: true,
        }),
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      },
    )
    // Graph returns an empty 202 on acceptance, not a message ID or delivery receipt.
    if (response.status !== 202) {
      return { success: false, provider, error: `Microsoft 365 send failed (HTTP ${response.status})` }
    }
    return { success: true, provider }
  } catch {
    // Never log request bodies, tokens, reset links, or provider response bodies.
    return { success: false, provider, error: 'Microsoft 365 email request failed; check connectivity and configuration' }
  }
}
