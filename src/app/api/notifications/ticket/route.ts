/**
 * API Route: Ticket Notifications
 * 
 * Handles sending notifications for ticket events
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { 
  buildTicketNotificationPayloads, 
  sendNotifications 
} from '@/lib/notifications/send'
import { 
  formatNotificationMessage, 
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
    const { ticketId, notificationType, context } = body

    if (!ticketId || !notificationType) {
      return NextResponse.json(
        { error: 'Missing required fields: ticketId, notificationType' },
        { status: 400 }
      )
    }

    // Validate notification type
    const validTypes: NotificationType[] = [
      'ticket_created',
      'ticket_updated',
      'ticket_comment',
      'ticket_assigned',
      'ticket_resolved',
      'ticket_closed',
      'sla_warning',
      'sla_breach',
    ]

    if (!validTypes.includes(notificationType)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      )
    }

    // Build notification payloads
    const payloads = await buildTicketNotificationPayloads(
      ticketId,
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
    console.error('[API] Notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
