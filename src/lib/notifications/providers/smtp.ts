import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { decrypt, decryptLegacy, encrypt } from '@/lib/crypto'

export type SmtpConfigPayload = {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  from_name?: string | null
  from_email?: string | null
  reply_to?: string | null
}

type SmtpRow = {
  id: string
  organization_id: string | null
  host: string
  port: number
  secure: boolean
  username: string
  password_encrypted: string
  password_iv: string
  password_auth_tag: string
  password_salt: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
}

export type EffectiveSmtpConfig = {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  fromName: string | null
  fromEmail: string | null
  replyTo: string | null
  organizationId: string | null
}

export async function getEffectiveSmtpConfig(
  organizationId?: string | null
): Promise<EffectiveSmtpConfig | null> {
  const admin = getSupabaseAdmin()

  if (organizationId) {
    const { data: orgRow } = await (admin as any)
      .from('smtp_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (orgRow) {
      return toEffectiveConfig(orgRow as SmtpRow)
    }
  }

  const { data: globalRow } = await (admin as any)
    .from('smtp_configurations')
    .select('*')
    .is('organization_id', null)
    .maybeSingle()

  if (!globalRow) return null

  return toEffectiveConfig(globalRow as SmtpRow)
}

function toEffectiveConfig(row: SmtpRow): EffectiveSmtpConfig | null {
  try {
    const password = row.password_salt
      ? decrypt(
          row.password_encrypted,
          row.password_iv,
          row.password_auth_tag,
          row.password_salt,
        )
      : decryptLegacy(row.password_encrypted, row.password_iv, row.password_auth_tag)

    return {
      host: row.host,
      port: row.port,
      secure: row.secure,
      username: row.username,
      password,
      fromName: row.from_name,
      fromEmail: row.from_email,
      replyTo: row.reply_to,
      organizationId: row.organization_id,
    }
  } catch (error) {
    console.error('[SMTP] Failed to decrypt SMTP password:', error)
    return null
  }
}

export async function sendWithSmtp(config: EffectiveSmtpConfig, input: {
  to: string
  subject: string
  html: string
  text?: string
  fromName?: string | null
  fromEmail?: string | null
  replyTo?: string | null
}) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  })

  const fromName = input.fromName || config.fromName || 'KT-Portal Support'
  const fromEmail = input.fromEmail || config.fromEmail || process.env.EMAIL_FROM || 'support@ktportal.app'

  const info = await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo || config.replyTo || undefined,
  })

  return info.messageId
}

export function encryptSmtpPassword(password: string) {
  const encrypted = encrypt(password)
  return {
    password_encrypted: encrypted.encryptedData,
    password_iv: encrypted.iv,
    password_auth_tag: encrypted.authTag,
    password_salt: encrypted.salt,
  }
}
