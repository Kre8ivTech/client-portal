/**
 * Ticket Notification Helpers
 * 
 * Helper functions to trigger notifications for ticket events
 * Can be called from server actions and API routes
 */

'use server'

import { formatNotificationMessage } from '@/lib/notifications'
import type { NotificationType } from '@/lib/notifications'

/**
 * Trigger notifications for a ticket event
 * Calls the notification API endpoint to send notifications
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
    const { subject, message } = formatNotificationMessage(notificationType, context)

    // Call the notification API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/ticket`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId,
          notificationType,
          context: {
            ...context,
            subject,
            message,
          },
        }),
      }
    )

    if (!response.ok) {
      console.error('[Notifications] Failed to send notification:', await response.text())
      return { success: false }
    }

    const data = await response.json()
    return { success: true, ...data }
  } catch (error) {
    console.error('[Notifications] Error triggering notification:', error)
    return { success: false }
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
