/**
 * API Route: Task Notifications
 *
 * Handles sending notifications for service request and project request events
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  buildTaskNotificationPayloads,
  sendNotifications
} from '@/lib/notifications/send'
import {
  NotificationType
} from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { taskId, taskType, notificationType, context } = body

    if (!taskId || !taskType || !notificationType) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, taskType, notificationType' },
        { status: 400 }
      )
    }

    // Validate task type
    if (taskType !== 'service_request' && taskType !== 'project_request') {
      return NextResponse.json(
        { error: 'Invalid task type. Must be service_request or project_request' },
        { status: 400 }
      )
    }

    // Validate notification type
    const validTypes: NotificationType[] = [
      'service_request_created',
      'service_request_assigned',
      'service_request_updated',
      'project_request_created',
      'project_request_assigned',
      'project_request_updated',
      'task_acknowledgement_reminder',
    ]

    if (!validTypes.includes(notificationType)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      )
    }

    // Build notification payloads
    const payloads = await buildTaskNotificationPayloads(
      taskId,
      taskType,
      notificationType,
      context
    )

    if (payloads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No notifications to send (no recipients configured)',
        sent: 0,
      })
    }

    // Send notifications
    const results = await sendNotifications(payloads)

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      results,
    })
  } catch (error) {
    console.error('[API] Task Notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
