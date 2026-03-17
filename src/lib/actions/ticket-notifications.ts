/**
 * Ticket Notification Helpers
 * 
 * Helper functions to trigger notifications for ticket events.
 * Called from server actions, API routes, and components.
 * Uses the notification infrastructure directly (no self-fetch).
 */

'use server'

import { formatNotificationMessage } from '@/lib/notifications'
import type { NotificationType } from '@/lib/notifications'
import { buildTicketNotificationPayloads, sendNotifications } from '@/lib/notifications/send'

/**
 * Trigger notifications for a ticket event.
 * Builds payloads (respecting preferences) and sends via all enabled channels.
 */
export async function notifyTicketEvent(
  ticketId: string,
  notificationType: NotificationType,
  context?: {
    ticketNumber?: number
    ticketSubject?: string
    assigneeName?: string
    commenterName?: string
    commentPreview?: string
    status?: string
    priority?: string
  }
) {
  try {
    // Format the notification message
    const { subject, message } = formatNotificationMessage(notificationType, context ?? {})

    // Build payloads for all recipients and channels
    const payloads = await buildTicketNotificationPayloads(ticketId, notificationType, {
      ...context,
      subject,
      message,
    })

    if (payloads.length === 0) {
      return { success: true, sent: 0 }
    }

    // Send all notifications
    const results = await sendNotifications(payloads)
    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return { success: true, sent, failed }
  } catch (error) {
    console.error('[Notifications] Error triggering ticket notification:', error)
    return { success: false, error: 'Failed to send notifications' }
  }
}

/**
 * Notify when a new ticket is created
 */
export async function notifyTicketCreated(
  ticketId: string,
  ticketNumber: number,
  ticketSubject: string,
  priority: string
) {
  return notifyTicketEvent(ticketId, 'ticket_created', {
    ticketNumber,
    ticketSubject,
    priority,
  })
}

/**
 * Notify when a ticket is updated
 */
export async function notifyTicketUpdated(
  ticketId: string,
  ticketNumber: number,
  ticketSubject: string,
  status: string
) {
  return notifyTicketEvent(ticketId, 'ticket_updated', {
    ticketNumber,
    ticketSubject,
    status,
  })
}

/**
 * Notify when a comment is added to a ticket
 */
export async function notifyTicketComment(
  ticketId: string,
  ticketNumber: number,
  ticketSubject: string,
  commenterName: string,
  commentPreview: string
) {
  return notifyTicketEvent(ticketId, 'ticket_comment', {
    ticketNumber,
    ticketSubject,
    commenterName,
    commentPreview: commentPreview.substring(0, 100),
  })
}

/**
 * Notify when a ticket is assigned
 */
export async function notifyTicketAssigned(
  ticketId: string,
  ticketNumber: number,
  ticketSubject: string,
  assigneeName: string,
  priority: string
) {
  return notifyTicketEvent(ticketId, 'ticket_assigned', {
    ticketNumber,
    ticketSubject,
    assigneeName,
    priority,
  })
}

/**
 * Notify when a ticket is resolved
 */
export async function notifyTicketResolved(
  ticketId: string,
  ticketNumber: number,
  ticketSubject: string
) {
  return notifyTicketEvent(ticketId, 'ticket_resolved', {
    ticketNumber,
    ticketSubject,
  })
}

/**
 * Notify when a ticket is closed
 */
export async function notifyTicketClosed(
  ticketId: string,
  ticketNumber: number,
  ticketSubject: string
) {
  return notifyTicketEvent(ticketId, 'ticket_closed', {
    ticketNumber,
    ticketSubject,
  })
}
