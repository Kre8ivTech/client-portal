/**
 * Unified Notification Sender
 * 
 * Orchestrates sending notifications across multiple channels
 * and logs all notifications to the database
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { 
  NotificationPayload, 
  NotificationResult, 
  NotificationChannel 
} from './index'
import { sendEmail } from './providers/email'
import { sendSMS } from './providers/sms'
import { sendSlack } from './providers/slack'
import { sendWhatsApp } from './providers/whatsapp'

// Use admin client for logging notifications (bypasses RLS)
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Send a notification through the specified channel
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const { channel, recipient, type, subject, message, ticketId } = payload

  let result: NotificationResult

  // Send via appropriate channel
  switch (channel) {
    case 'email':
      result = await sendEmail({
        to: recipient,
        subject: subject || 'Notification',
        message,
        ticketId,
      })
      break

    case 'sms':
      result = await sendSMS({
        to: recipient,
        message: `${subject || 'Notification'}\n\n${message}`,
      })
      break

    case 'slack':
      result = await sendSlack({
        webhookUrl: recipient,
        subject: subject || 'Notification',
        message,
        type,
        ticketId,
      })
      break

    case 'whatsapp':
      result = await sendWhatsApp({
        to: recipient,
        message: `${subject || 'Notification'}\n\n${message}`,
      })
      break

    default:
      result = {
        success: false,
        error: `Unsupported notification channel: ${channel}`,
      }
  }

  // Log notification to database
  await logNotification(payload, result)

  return result
}

/**
 * Send notifications to multiple channels
 */
export async function sendNotifications(
  payloads: NotificationPayload[]
): Promise<NotificationResult[]> {
  return Promise.all(payloads.map(sendNotification))
}

/**
 * Log notification attempt to database
 */
async function logNotification(
  payload: NotificationPayload,
  result: NotificationResult
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('notification_log').insert({
      organization_id: payload.organizationId,
      user_id: payload.userId || null,
      notification_type: payload.type,
      channel: payload.channel,
      ticket_id: payload.ticketId || null,
      comment_id: payload.commentId || null,
      subject: payload.subject || null,
      message: payload.message,
      recipient: payload.recipient,
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      failed_at: result.success ? null : new Date().toISOString(),
      error_message: result.error || null,
      provider: result.provider || null,
      provider_message_id: result.messageId || null,
      metadata: payload.metadata || {},
    })

    if (error) {
      console.error('[Notifications] Failed to log notification:', error)
    }
  } catch (err) {
    console.error('[Notifications] Error logging notification:', err)
  }
}

/**
 * Get notification preferences for a user
 */
export async function getUserNotificationPreferences(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('notification_preferences, email')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[Notifications] Failed to get user preferences:', error)
    return null
  }

  return data
}

/**
 * Get notification preferences for an organization
 */
export async function getOrgNotificationPreferences(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('notification_preferences')
    .eq('id', orgId)
    .single()

  if (error) {
    console.error('[Notifications] Failed to get org preferences:', error)
    return null
  }

  return data?.notification_preferences
}

/**
 * Build notification payloads for a ticket event
 */
export async function buildTicketNotificationPayloads(
  ticketId: string,
  notificationType: NotificationPayload['type'],
  context?: Record<string, any>
): Promise<NotificationPayload[]> {
  // Get ticket details
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .select(`
      *,
      organization:organizations(id, name, notification_preferences, is_priority_client),
      created_by_user:users!tickets_created_by_fkey(id, email, full_name, notification_preferences),
      assigned_to_user:users!tickets_assigned_to_fkey(id, email, full_name, notification_preferences)
    `)
    .eq('id', ticketId)
    .single()

  if (ticketError || !ticket) {
    console.error('[Notifications] Failed to get ticket:', ticketError)
    return []
  }

  const payloads: NotificationPayload[] = []

  // Determine recipients based on notification type
  const recipients = new Set<string>()

  // Always notify the ticket creator (unless they're the one taking action)
  if (ticket.created_by_user) {
    recipients.add(ticket.created_by_user.id)
  }

  // For assignment notifications, notify the assignee
  if (notificationType === 'ticket_assigned' && ticket.assigned_to_user) {
    recipients.add(ticket.assigned_to_user.id)
  }

  // For other notifications, notify both creator and assignee
  if (
    notificationType !== 'ticket_assigned' &&
    notificationType !== 'ticket_created' &&
    ticket.assigned_to_user
  ) {
    recipients.add(ticket.assigned_to_user.id)
  }

  // Build payloads for each recipient
  for (const userId of recipients) {
    const user =
      ticket.created_by_user?.id === userId
        ? ticket.created_by_user
        : ticket.assigned_to_user

    if (!user) continue

    const userPrefs = user.notification_preferences || {}
    const channels: NotificationChannel[] = []

    // Check which channels are enabled
    if (userPrefs.email !== false && user.email) {
      channels.push('email')
    }
    if (userPrefs.sms && userPrefs.sms_number) {
      channels.push('sms')
    }
    if (userPrefs.whatsapp && userPrefs.whatsapp_number) {
      channels.push('whatsapp')
    }

    // Create payload for each enabled channel
    for (const channel of channels) {
      const recipient =
        channel === 'email'
          ? user.email
          : channel === 'sms'
          ? userPrefs.sms_number
          : userPrefs.whatsapp_number

      if (!recipient) continue

      payloads.push({
        type: notificationType,
        channel,
        recipient,
        organizationId: ticket.organization_id,
        userId: user.id,
        ticketId: ticket.id,
        subject: context?.subject,
        message: context?.message,
        metadata: {
          ticketNumber: ticket.ticket_number,
          ticketSubject: ticket.subject,
          priority: ticket.priority,
          ...context,
        },
      })
    }
  }

  // Also check for organization-level Slack notifications
  const orgPrefs = ticket.organization?.notification_preferences || {}
  if (orgPrefs.slack && orgPrefs.slack_webhook_url) {
    payloads.push({
      type: notificationType,
      channel: 'slack',
      recipient: orgPrefs.slack_webhook_url,
      organizationId: ticket.organization_id,
      ticketId: ticket.id,
      subject: context?.subject,
      message: context?.message,
      metadata: {
        ticketNumber: ticket.ticket_number,
        ticketSubject: ticket.subject,
        priority: ticket.priority,
        ...context,
      },
    })
  }

  return payloads
}
