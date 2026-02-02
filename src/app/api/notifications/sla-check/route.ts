/**
 * API Route: SLA Check
 * 
 * Checks for tickets approaching or breaching SLA and sends notifications
 * This should be called by a cron job regularly (e.g., every 15 minutes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { 
  buildTicketNotificationPayloads, 
  sendNotifications 
} from '@/lib/notifications/send'
import { formatNotificationMessage } from '@/lib/notifications'

// Use admin client to bypass RLS
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tickets needing SLA notifications
    const { data: tickets, error } = await supabaseAdmin.rpc(
      'get_tickets_needing_sla_notifications'
    )

    if (error) {
      console.error('[SLA Check] Failed to get tickets:', error)
      return NextResponse.json(
        { error: 'Failed to check SLA tickets' },
        { status: 500 }
      )
    }

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tickets need SLA notifications',
        checked: 0,
        notified: 0,
      })
    }

    let notificationsSent = 0
    const results = []

    // Process each ticket
    for (const ticket of tickets) {
      if (!ticket.notification_level) continue

      const notificationType =
        ticket.notification_level === 'breach' ? 'sla_breach' : 'sla_warning'

      // Check if we've already sent this notification recently
      const { data: recentNotification } = await supabaseAdmin
        .from('notification_log')
        .select('id')
        .eq('ticket_id', ticket.ticket_id)
        .eq('notification_type', notificationType)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .limit(1)

      if (recentNotification && recentNotification.length > 0) {
        // Already notified recently, skip
        continue
      }

      // Format notification message
      const { subject, message } = formatNotificationMessage(notificationType, {
        ticketNumber: ticket.ticket_number,
        ticketSubject: ticket.subject,
        priority: ticket.priority,
        hoursOverdue:
          ticket.notification_level === 'breach'
            ? Math.abs(ticket.hours_until_first_response || ticket.hours_until_resolution || 0)
            : undefined,
        hoursUntilDue:
          ticket.notification_level === 'warning'
            ? Math.max(0, ticket.hours_until_first_response || ticket.hours_until_resolution || 0)
            : undefined,
      })

      // Build and send notifications
      const payloads = await buildTicketNotificationPayloads(
        ticket.ticket_id,
        notificationType,
        { subject, message }
      )

      if (payloads.length > 0) {
        await sendNotifications(payloads)
        notificationsSent += payloads.length
        results.push({
          ticketId: ticket.ticket_id,
          ticketNumber: ticket.ticket_number,
          level: ticket.notification_level,
          notificationsSent: payloads.length,
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: tickets.length,
      notified: notificationsSent,
      results,
    })
  } catch (error) {
    console.error('[SLA Check] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
