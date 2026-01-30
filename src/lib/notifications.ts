import { supabaseAdmin } from '@/lib/supabase/admin'

interface NotificationPayload {
  organizationId: string
  recipientIds: string[]
  createdBy: string
  title: string
  body: string
  type: string
  metadata?: Record<string, unknown>
}

const DEFAULT_FROM_EMAIL = 'KT Portal <notifications@ktportal.app>'

export async function createNotifications(payload: NotificationPayload) {
  const recipients = Array.from(new Set(payload.recipientIds)).filter(Boolean)

  if (recipients.length === 0) return

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, organization_id')
    .in('id', recipients)

  if (error || !profiles) return

  const eligibleProfiles = profiles.filter(
    (profile) => profile.organization_id === payload.organizationId
  )

  if (eligibleProfiles.length === 0) return

  const notifications = eligibleProfiles.map((profile) => ({
    organization_id: payload.organizationId,
    user_id: profile.id,
    created_by: payload.createdBy,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    metadata: payload.metadata ?? {},
  }))

  await supabaseAdmin.from('notifications').insert(notifications)

  await Promise.all(
    eligibleProfiles
      .filter((profile) => Boolean(profile.email))
      .map((profile) =>
        sendEmail({
          to: profile.email as string,
          subject: payload.title,
          html: buildEmailHtml(profile.name ?? 'there', payload.body),
        })
      )
  )
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  })
}

function buildEmailHtml(recipientName: string, body: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <p>Hi ${recipientName},</p>
      <p>${body}</p>
      <p style="color: #6b7280; font-size: 12px;">
        You are receiving this notification because you have access to this ticket.
      </p>
    </div>
  `
}
