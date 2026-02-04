/**
 * Notification System
 * 
 * Handles multi-channel notifications for ticket events
 * Supports: Email, SMS, Slack, WhatsApp
 */

import { Database } from '@/types/database'

export type NotificationChannel = 'email' | 'sms' | 'slack' | 'whatsapp'

export type NotificationType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'ticket_comment'
  | 'ticket_assigned'
  | 'ticket_resolved'
  | 'ticket_closed'
  | 'sla_warning'
  | 'sla_breach'
  | 'service_request_created'
  | 'service_request_assigned'
  | 'service_request_updated'
  | 'project_request_created'
  | 'project_request_assigned'
  | 'project_request_updated'
  | 'task_acknowledgement_reminder'

export interface NotificationPayload {
  type: NotificationType
  channel: NotificationChannel
  recipient: string // email, phone, or webhook URL
  organizationId: string
  userId?: string
  ticketId?: string
  commentId?: string
  serviceRequestId?: string
  projectRequestId?: string
  taskAcknowledgementId?: string
  subject?: string
  message: string
  metadata?: Record<string, any>
}

export interface NotificationResult {
  success: boolean
  messageId?: string
  error?: string
  provider?: string
  templateId?: string
}

export interface NotificationPreferences {
  email?: boolean
  sms?: boolean
  slack?: boolean
  whatsapp?: boolean
  slack_webhook_url?: string | null
  whatsapp_number?: string | null
  sms_number?: string | null
  notify_on_ticket_created?: boolean
  notify_on_ticket_updated?: boolean
  notify_on_ticket_comment?: boolean
  notify_on_ticket_assigned?: boolean
  notify_on_ticket_resolved?: boolean
  notify_on_sla_warning?: boolean
  notify_on_sla_breach?: boolean
  notify_on_service_request_created?: boolean
  notify_on_service_request_assigned?: boolean
  notify_on_service_request_updated?: boolean
  notify_on_project_request_created?: boolean
  notify_on_project_request_assigned?: boolean
  notify_on_project_request_updated?: boolean
  notify_on_task_acknowledgement_reminder?: boolean
}

/**
 * Check if a notification should be sent based on preferences
 */
export function shouldSendNotification(
  type: NotificationType,
  channel: NotificationChannel,
  preferences: NotificationPreferences
): boolean {
  // Check if channel is enabled
  if (!preferences[channel]) {
    return false
  }

  // Check if notification type is enabled
  const typeKey = `notify_on_${type}` as keyof NotificationPreferences
  if (preferences[typeKey] === false) {
    return false
  }

  // For SMS and WhatsApp, check if number is configured
  if (channel === 'sms' && !preferences.sms_number) {
    return false
  }
  if (channel === 'whatsapp' && !preferences.whatsapp_number) {
    return false
  }
  
  // For Slack, check if webhook is configured
  if (channel === 'slack' && !preferences.slack_webhook_url) {
    return false
  }

  return true
}

/**
 * Get recipient for a notification channel
 */
export function getRecipient(
  channel: NotificationChannel,
  preferences: NotificationPreferences,
  email?: string
): string | null {
  switch (channel) {
    case 'email':
      return email || null
    case 'sms':
      return preferences.sms_number || null
    case 'whatsapp':
      return preferences.whatsapp_number || null
    case 'slack':
      return preferences.slack_webhook_url || null
    default:
      return null
  }
}

/**
 * Format notification message based on type and context
 */
export function formatNotificationMessage(
  type: NotificationType,
  context: {
    ticketNumber?: number
    ticketSubject?: string
    requestNumber?: string
    taskTitle?: string
    serviceName?: string
    projectTitle?: string
    assigneeName?: string
    commenterName?: string
    commentPreview?: string
    clientName?: string
    organizationName?: string
    status?: string
    priority?: string
    hoursOverdue?: number
    hoursUntilDue?: number
    hoursAgo?: number
  }
): { subject: string; message: string } {
  const { 
    ticketNumber, 
    ticketSubject, 
    assigneeName, 
    commenterName, 
    commentPreview,
    status,
    priority,
    hoursOverdue,
    hoursUntilDue
  } = context

  const ticketRef = ticketNumber ? `#${ticketNumber}` : 'A ticket'
  const ticketTitle = ticketSubject ? `"${ticketSubject}"` : ''

  switch (type) {
    case 'ticket_created':
      return {
        subject: `New Support Ticket Created: ${ticketRef}`,
        message: `A new support ticket has been created.\n\nTicket: ${ticketRef} ${ticketTitle}\nPriority: ${priority || 'Medium'}\n\nPlease review and respond as soon as possible.`
      }

    case 'ticket_updated':
      return {
        subject: `Ticket Updated: ${ticketRef}`,
        message: `Ticket ${ticketRef} ${ticketTitle} has been updated.\n\nNew Status: ${status || 'Unknown'}\n\nView the ticket for more details.`
      }

    case 'ticket_comment':
      return {
        subject: `New Comment on Ticket ${ticketRef}`,
        message: `${commenterName || 'Someone'} commented on ticket ${ticketRef} ${ticketTitle}\n\n"${commentPreview || 'View the full comment in the ticket.'}"\n\nRespond to keep the conversation going.`
      }

    case 'ticket_assigned':
      return {
        subject: `Ticket Assigned to You: ${ticketRef}`,
        message: `You have been assigned to ticket ${ticketRef} ${ticketTitle}\n\nPriority: ${priority || 'Medium'}\n\nPlease review and respond according to the SLA requirements.`
      }

    case 'ticket_resolved':
      return {
        subject: `Ticket Resolved: ${ticketRef}`,
        message: `Ticket ${ticketRef} ${ticketTitle} has been marked as resolved.\n\nIf you have any questions or the issue persists, please reopen the ticket.`
      }

    case 'ticket_closed':
      return {
        subject: `Ticket Closed: ${ticketRef}`,
        message: `Ticket ${ticketRef} ${ticketTitle} has been closed.\n\nThank you for using our support system.`
      }

    case 'sla_warning':
      return {
        subject: `⚠️ SLA Warning: Ticket ${ticketRef} Approaching Deadline`,
        message: `Ticket ${ticketRef} ${ticketTitle} is approaching its SLA deadline.\n\nPriority: ${priority || 'Medium'}\nTime Remaining: ${hoursUntilDue ? `${Math.round(hoursUntilDue)} hours` : 'Less than 1 hour'}\n\nPlease respond urgently to meet the SLA commitment.`
      }

    case 'sla_breach':
      return {
        subject: `🚨 SLA BREACH: Ticket ${ticketRef} Overdue`,
        message: `URGENT: Ticket ${ticketRef} ${ticketTitle} has breached its SLA deadline.\n\nPriority: ${priority || 'Medium'}\nOverdue By: ${hoursOverdue ? `${Math.round(hoursOverdue)} hours` : 'Less than 1 hour'}\n\nImmediate action required!`
      }

    case 'service_request_created':
      return {
        subject: `New Service Request: ${context.serviceName || 'Service'} - ${context.requestNumber || ''}`,
        message: `A new service request has been submitted by ${context.clientName || 'a client'} from ${context.organizationName || 'their organization'}.\n\nRequest: ${context.requestNumber || 'N/A'}\nService: ${context.serviceName || 'N/A'}\nPriority: ${priority || 'Medium'}\n\nPlease acknowledge receipt and review the request within 24 hours.`
      }

    case 'service_request_assigned':
      return {
        subject: `Service Request Assigned to You: ${context.requestNumber || ''}`,
        message: `You have been assigned to service request ${context.requestNumber || 'N/A'}\n\nService: ${context.serviceName || 'N/A'}\nClient: ${context.clientName || 'N/A'}\nPriority: ${priority || 'Medium'}\n\nPlease acknowledge receipt and review the request.`
      }

    case 'service_request_updated':
      return {
        subject: `Service Request Updated: ${context.requestNumber || ''}`,
        message: `Service request ${context.requestNumber || 'N/A'} has been updated.\n\nService: ${context.serviceName || 'N/A'}\nNew Status: ${status || 'Unknown'}\n\nView the request for more details.`
      }

    case 'project_request_created':
      return {
        subject: `New Project Request: ${context.projectTitle || 'Project'} - ${context.requestNumber || ''}`,
        message: `A new project request has been submitted by ${context.clientName || 'a client'} from ${context.organizationName || 'their organization'}.\n\nRequest: ${context.requestNumber || 'N/A'}\nProject: ${context.projectTitle || 'N/A'}\nPriority: ${priority || 'Medium'}\n\nPlease acknowledge receipt and review the request within 24 hours.`
      }

    case 'project_request_assigned':
      return {
        subject: `Project Request Assigned to You: ${context.requestNumber || ''}`,
        message: `You have been assigned to project request ${context.requestNumber || 'N/A'}\n\nProject: ${context.projectTitle || 'N/A'}\nClient: ${context.clientName || 'N/A'}\nPriority: ${priority || 'Medium'}\n\nPlease acknowledge receipt and review the request.`
      }

    case 'project_request_updated':
      return {
        subject: `Project Request Updated: ${context.requestNumber || ''}`,
        message: `Project request ${context.requestNumber || 'N/A'} has been updated.\n\nProject: ${context.projectTitle || 'N/A'}\nNew Status: ${status || 'Unknown'}\n\nView the request for more details.`
      }

    case 'task_acknowledgement_reminder':
      return {
        subject: `REMINDER: Unacknowledged ${context.taskTitle || 'Task'} - ${context.requestNumber || ''}`,
        message: `URGENT: This request has been pending for over 24 hours without acknowledgement.\n\nRequest: ${context.requestNumber || 'N/A'}\n${context.taskTitle || 'Task'}\nClient: ${context.clientName || 'N/A'}\nSubmitted: ${context.hoursAgo ? `${Math.round(context.hoursAgo)} hours ago` : 'Unknown'}\n\nPlease acknowledge this request immediately to ensure timely service delivery.`
      }

    default:
      return {
        subject: `Ticket Notification: ${ticketRef}`,
        message: `An update has been made to ticket ${ticketRef} ${ticketTitle}`
      }
  }
}

/**
 * Get notification color for Slack messages
 */
export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'sla_breach':
    case 'task_acknowledgement_reminder':
      return '#dc2626' // red-600
    case 'sla_warning':
      return '#ea580c' // orange-600
    case 'ticket_created':
    case 'ticket_assigned':
    case 'service_request_created':
    case 'service_request_assigned':
      return '#2563eb' // blue-600
    case 'project_request_created':
    case 'project_request_assigned':
      return '#7C3AED' // purple-600
    case 'ticket_resolved':
      return '#16a34a' // green-600
    default:
      return '#64748b' // slate-500
  }
}

/**
 * Get notification priority level
 */
export function getNotificationPriority(type: NotificationType): 'low' | 'medium' | 'high' | 'critical' {
  switch (type) {
    case 'sla_breach':
    case 'task_acknowledgement_reminder':
      return 'critical'
    case 'sla_warning':
      return 'high'
    case 'ticket_created':
    case 'ticket_assigned':
    case 'service_request_created':
    case 'service_request_assigned':
    case 'project_request_created':
    case 'project_request_assigned':
      return 'high'
    case 'ticket_comment':
    case 'service_request_updated':
    case 'project_request_updated':
      return 'medium'
    default:
      return 'low'
  }
}
