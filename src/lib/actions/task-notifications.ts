/**
 * Task Notification Helpers
 *
 * Helper functions to trigger notifications for service request and project request events.
 * Called from server actions, API routes, and components.
 * Uses the notification infrastructure directly (no self-fetch).
 */

'use server'

import { formatNotificationMessage } from '@/lib/notifications'
import type { NotificationType } from '@/lib/notifications'
import { buildTaskNotificationPayloads, sendNotifications } from '@/lib/notifications/send'

/**
 * Trigger notifications for a task event (service request or project request).
 * Builds payloads (respecting preferences) and sends via all enabled channels.
 */
export async function notifyTaskEvent(
  taskId: string,
  taskType: 'service_request' | 'project_request',
  notificationType: NotificationType,
  context?: {
    requestNumber?: string
    serviceName?: string
    projectTitle?: string
    clientName?: string
    organizationName?: string
    priority?: string
    status?: string
    hoursAgo?: number
  }
) {
  try {
    // Format the notification message
    const { subject, message } = formatNotificationMessage(notificationType, {
      ...context,
      taskTitle: taskType === 'service_request' ? context?.serviceName : context?.projectTitle,
    })

    // Build payloads for all recipients and channels
    const payloads = await buildTaskNotificationPayloads(taskId, taskType, notificationType, {
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
    console.error('[Task Notifications] Error triggering notification:', error)
    return { success: false, error: 'Failed to send notifications' }
  }
}

/**
 * Notify when a new service request is created
 */
export async function notifyServiceRequestCreated(
  serviceRequestId: string,
  requestNumber: string,
  serviceName: string,
  clientName: string,
  organizationName: string,
  priority: string
) {
  return notifyTaskEvent(
    serviceRequestId,
    'service_request',
    'service_request_created',
    {
      requestNumber,
      serviceName,
      clientName,
      organizationName,
      priority,
    }
  )
}

/**
 * Notify when a service request is assigned to staff
 */
export async function notifyServiceRequestAssigned(
  serviceRequestId: string,
  requestNumber: string,
  serviceName: string,
  clientName: string,
  priority: string
) {
  return notifyTaskEvent(
    serviceRequestId,
    'service_request',
    'service_request_assigned',
    {
      requestNumber,
      serviceName,
      clientName,
      priority,
    }
  )
}

/**
 * Notify when a service request is updated
 */
export async function notifyServiceRequestUpdated(
  serviceRequestId: string,
  requestNumber: string,
  serviceName: string,
  status: string
) {
  return notifyTaskEvent(
    serviceRequestId,
    'service_request',
    'service_request_updated',
    {
      requestNumber,
      serviceName,
      status,
    }
  )
}

/**
 * Notify when a new project request is created
 */
export async function notifyProjectRequestCreated(
  projectRequestId: string,
  requestNumber: string,
  projectTitle: string,
  clientName: string,
  organizationName: string,
  priority: string
) {
  return notifyTaskEvent(
    projectRequestId,
    'project_request',
    'project_request_created',
    {
      requestNumber,
      projectTitle,
      clientName,
      organizationName,
      priority,
    }
  )
}

/**
 * Notify when a project request is assigned to staff
 */
export async function notifyProjectRequestAssigned(
  projectRequestId: string,
  requestNumber: string,
  projectTitle: string,
  clientName: string,
  priority: string
) {
  return notifyTaskEvent(
    projectRequestId,
    'project_request',
    'project_request_assigned',
    {
      requestNumber,
      projectTitle,
      clientName,
      priority,
    }
  )
}

/**
 * Notify when a project request is updated
 */
export async function notifyProjectRequestUpdated(
  projectRequestId: string,
  requestNumber: string,
  projectTitle: string,
  status: string
) {
  return notifyTaskEvent(
    projectRequestId,
    'project_request',
    'project_request_updated',
    {
      requestNumber,
      projectTitle,
      status,
    }
  )
}

/**
 * Send 24-hour reminder for unacknowledged task
 */
export async function notifyTaskAcknowledgementReminder(
  taskId: string,
  taskType: 'service_request' | 'project_request',
  requestNumber: string,
  taskTitle: string,
  clientName: string,
  organizationName: string,
  priority: string,
  hoursAgo: number
) {
  return notifyTaskEvent(
    taskId,
    taskType,
    'task_acknowledgement_reminder',
    {
      requestNumber,
      ...(taskType === 'service_request' ? { serviceName: taskTitle } : { projectTitle: taskTitle }),
      clientName,
      organizationName,
      priority,
      hoursAgo,
    }
  )
}
