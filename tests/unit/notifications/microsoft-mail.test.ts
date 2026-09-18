import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasMicrosoftMailConfiguration, sendWithMicrosoft } from '@/lib/notifications/providers/microsoft'
import { sendEmail, sendRawEmail, sendTemplatedEmail } from '@/lib/notifications/providers/email'
import { getEffectiveSmtpConfig, sendWithSmtp } from '@/lib/notifications/providers/smtp'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

vi.mock('@/lib/notifications/providers/smtp', () => ({
  getEffectiveSmtpConfig: vi.fn(), sendWithSmtp: vi.fn(),
}))
const input = { to: 'recipient@example.com', subject: 'Reset password', html: '<p>Recovery link</p>' }
const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  vi.stubEnv('MICROSOFT_MAIL_TENANT_ID', '11111111-1111-4111-8111-111111111111')
  vi.stubEnv('MICROSOFT_MAIL_CLIENT_ID', '22222222-2222-4222-8222-222222222222')
  vi.stubEnv('MICROSOFT_MAIL_CLIENT_SECRET', 'test-secret')
  vi.stubEnv('MICROSOFT_MAIL_SENDER', 'info@example.com')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
  vi.mocked(getEffectiveSmtpConfig).mockResolvedValue(null)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks() })

function acceptMail() {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' })))
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
}

describe('Microsoft 365 delivery', () => {
  it('uses the configured sender, client credentials, and accepts an empty 202 without inventing a message ID', async () => {
    acceptMail()
    expect(await sendWithMicrosoft(input)).toEqual({ success: true, provider: 'microsoft365' })
    const [url, options] = fetchMock.mock.calls[1]
    expect(url).toBe('https://graph.microsoft.com/v1.0/users/info%40example.com/sendMail')
    expect(JSON.parse(options.body).message.from.emailAddress.address).toBe('info@example.com')
    expect(JSON.parse(options.body).saveToSentItems).toBe(true)
    expect(fetchMock.mock.calls[0][1].body.get('grant_type')).toBe('client_credentials')
  })
  it('fails partial configuration without making requests', async () => {
    vi.stubEnv('MICROSOFT_MAIL_CLIENT_SECRET', '')
    expect(hasMicrosoftMailConfiguration()).toBe(true)
    expect((await sendWithMicrosoft(input)).success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not expose authentication errors or send after token rejection', async () => {
    fetchMock.mockResolvedValueOnce(new Response('secret detail', { status: 401 }))
    expect(await sendWithMicrosoft(input)).toEqual({ success: false, provider: 'microsoft365', error: 'Microsoft 365 authentication failed (HTTP 401)' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('reports send permission denial without returning provider contents', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' })))
      .mockResolvedValueOnce(new Response('private detail', { status: 403 }))
    expect((await sendWithMicrosoft(input)).error).toBe('Microsoft 365 send failed (HTTP 403)')
  })
  it('reports network failure without leaking request details or retrying a send', async () => {
    fetchMock.mockRejectedValueOnce(new Error('secret detail'))
    expect((await sendWithMicrosoft(input)).error).not.toContain('secret detail')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('routes basic notifications to Microsoft 365', async () => {
    acceptMail()
    expect((await sendEmail({ to: input.to, subject: input.subject, message: 'Hello' })).provider).toBe('microsoft365')
  })
  it('routes raw email to Microsoft 365', async () => {
    acceptMail()
    expect((await sendRawEmail(input)).success).toBe(true)
  })
  it('routes password reset fallback to Microsoft 365', async () => {
    acceptMail()
    expect((await sendTemplatedEmail({ to: input.to, templateType: 'password_reset', variables: { subject: input.subject, message: 'Reset your password' } })).provider).toBe('microsoft365')
  })
  it('keeps the configured mailbox when a stored template specifies another sender', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only')
    const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.is.mockReturnValue(query)
    query.single.mockResolvedValue({ data: {
      id: 'template-id', subject: 'Reset {{name}}', body_html: '<p>{{message}}</p>',
      from_email: 'support@ktportal.app', from_name: 'Old name', reply_to: 'reply@example.com',
    } })
    vi.mocked(createClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createClient>)
    acceptMail()
    const result = await sendTemplatedEmail({ to: input.to, templateType: 'password_reset', variables: { name: 'User', message: 'Reset link' } })
    expect(result).toEqual({ success: true, provider: 'microsoft365', templateId: 'template-id' })
    const message = JSON.parse(fetchMock.mock.calls[1][1].body).message
    expect(message.from.emailAddress.address).toBe('info@example.com')
    expect(message.subject).toBe('Reset User')
    expect(message.replyTo[0].emailAddress.address).toBe('reply@example.com')
  })
  it('preserves organization SMTP precedence', async () => {
    vi.mocked(getEffectiveSmtpConfig).mockResolvedValue({ host: 'smtp.example.com', port: 465, secure: true, username: 'user', password: 'test', fromName: null, fromEmail: null, replyTo: null, organizationId: 'org' })
    vi.mocked(sendWithSmtp).mockResolvedValue('smtp-id')
    expect((await sendRawEmail({ ...input, organizationId: 'org' })).provider).toBe('smtp')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
