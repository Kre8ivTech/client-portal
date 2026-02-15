/**
 * Unified Notification Sender
 * 
 * Orchestrates sending notifications across multiple channels
 * and logs all notifications to the database
 */

import { createClient } from '@supabase/supabase-js'
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
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any

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

/**
 * Build notification payloads for a task event (service request or project request)
 */
export async function buildTaskNotificationPayloads(
  taskId: string,
  taskType: 'service_request' | 'project_request',
  notificationType: NotificationPayload['type'],
  context?: Record<string, any>
): Promise<NotificationPayload[]> {
  const tableName = taskType === 'service_request' ? 'service_requests' : 'project_requests'

  // Get task details
  const { data: task, error: taskError } = await supabaseAdmin
    .from(tableName)
    .select(`
      *,
      organization:organizations(id, name, notification_preferences),
      requested_by_user:users!${tableName}_requested_by_fkey(id, email, role, profiles:profiles(name))
    `)
    .eq('id', taskId)
    .single()

  if (taskError || !task) {
    console.error('[Notifications] Failed to get task:', taskError)
    return []
  }

  const payloads: NotificationPayload[] = []
  const recipients = new Map<string, any>() // Map of userId -> user details

  // Get assigned staff for this task
  const { data: assignments } = await supabaseAdmin
    .from('staff_assignments')
    .select(`
      staff_user_id,
      role,
      staff_user:users!staff_assignments_staff_user_id_fkey(
        id,
        email,
        role,
        profiles:profiles(name)
      )
    `)
    .eq('assignable_type', taskType)
    .eq('assignable_id', taskId)
    .is('unassigned_at', null) // Only active assignments

  // Add assigned staff to recipients
  if (assignments) {
    for (const assignment of assignments) {
      if (assignment.staff_user) {
        recipients.set(assignment.staff_user.id, assignment.staff_user)
      }
    }
  }

  // Get all admins and staff from the organization for 'created' notifications
  if (notificationType === 'service_request_created' || notificationType === 'project_request_created') {
    const { data: staffUsers } = await supabaseAdmin
      .from('users')
      .select('id, email, role, profiles:profiles(name)')
      .eq('organization_id', task.organization_id)
      .in('role', ['super_admin', 'staff', 'partner', 'partner_staff'])

    if (staffUsers) {
      for (const user of staffUsers) {
        if (!recipients.has(user.id)) {
          recipients.set(user.id, user)
        }
      }
    }
  }

  // Create acknowledgement tokens for each recipient
  const acknowledgementTokens = new Map<string, string>()

  for (const [userId, user] of recipients) {
    // Create acknowledgement record (acknowledged_at will be null until acknowledged)
    const { data: ack, error: ackError } = await supabaseAdmin
      .from('task_acknowledgements')
      .insert({
        organization_id: task.organization_id,
        task_type: taskType,
        task_id: taskId,
        acknowledged_by: userId,
      })
      .select('acknowledgement_token')
      .single()

    if (!ackError && ack) {
      acknowledgementTokens.set(userId, ack.acknowledgement_token)
    }
  }

  // Build payloads for each recipient
  for (const [userId, user] of recipients) {
    if (!user.email) continue

    const acknowledgementToken = acknowledgementTokens.get(userId)
    if (!acknowledgementToken) continue

    // Build acknowledgement URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const acknowledgementUrl = `${appUrl}/api/tasks/acknowledge?token=${acknowledgementToken}`

    // Build request URL
    const requestPath = taskType === 'service_request' ? 'service-requests' : 'project-requests'
    const requestUrl = `${appUrl}/${requestPath}/${taskId}`

    payloads.push({
      type: notificationType,
      channel: 'email',
      recipient: user.email,
      organizationId: task.organization_id,
      userId: user.id,
      ...(taskType === 'service_request' ? { serviceRequestId: taskId } : { projectRequestId: taskId }),
      subject: context?.subject,
      message: context?.message,
      metadata: {
        requestNumber: task.request_number,
        taskType,
        taskId,
        acknowledgementUrl,
        acknowledgementToken,
        requestUrl,
        recipientName: user.profiles?.name || user.email,
        clientName: task.requested_by_user?.profiles?.name || 'Unknown',
        organizationName: task.organization?.name || 'Unknown',
        priority: task.priority || 'medium',
        status: task.status,
        ...(taskType === 'service_request' && { serviceName: task.service_id }),
        ...(taskType === 'project_request' && { projectTitle: task.title }),
        currentYear: new Date().getFullYear(),
        ...context,
      },
    })
  }

  return payloads
}
