/**
 * Real-time SLA Monitoring
 * 
 * Client-side and server-side SLA monitoring that doesn't rely on cron jobs
 * Checks SLA status whenever tickets are accessed and triggers notifications
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { sendNotifications, buildTicketNotificationPayloads } from './send'
import { formatNotificationMessage } from './index'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SLACheckResult {
  checked: number
  notified: number
  tickets: Array<{
    ticketId: string
    ticketNumber: number
    level: 'warning' | 'breach'
  }>
}

/**
 * Check SLA status for active tickets and send notifications if needed
 * This can be called from API routes, server actions, or background tasks
 */
export async function checkAndNotifySLA(): Promise<SLACheckResult> {
  try {
    // Get tickets needing SLA notifications
    const { data: tickets, error } = await supabaseAdmin.rpc(
      'get_tickets_needing_sla_notifications'
    )

    if (error) {
      console.error('[SLA Monitor] Failed to get tickets:', error)
      return { checked: 0, notified: 0, tickets: [] }
    }

    if (!tickets || tickets.length === 0) {
      return { checked: 0, notified: 0, tickets: [] }
    }

    let notificationsSent = 0
    const results: SLACheckResult['tickets'] = []

    // Process each ticket
    for (const ticket of tickets) {
      if (!ticket.notification_level) continue

      const notificationType =
        ticket.notification_level === 'breach' ? 'sla_breach' : 'sla_warning'

      // Check if we've already sent this notification recently (last 4 hours)
      const { data: recentNotification } = await supabaseAdmin
        .from('notification_log')
        .select('id')
        .eq('ticket_id', ticket.ticket_id)
        .eq('notification_type', notificationType)
        .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
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
          level: ticket.notification_level as 'warning' | 'breach',
        })
      }
    }

    return {
      checked: tickets.length,
      notified: notificationsSent,
      tickets: results,
    }
  } catch (error) {
    console.error('[SLA Monitor] Error:', error)
    return { checked: 0, notified: 0, tickets: [] }
  }
}

/**
 * Check SLA for a specific ticket
 * Use this when ticket is viewed or updated to trigger real-time notifications
 */
export async function checkTicketSLA(ticketId: string): Promise<boolean> {
  try {
    // Get the specific ticket with SLA info
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .select(`
        id,
        ticket_number,
        subject,
        priority,
        status,
        created_at,
        first_response_due_at,
        first_response_at,
        sla_due_at,
        resolved_at,
        organization:organizations(is_priority_client)
      `)
      .eq('id', ticketId)
      .single()

    if (error || !ticket) {
      return false
    }

    // Skip if already resolved/closed
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return false
    }

    const now = new Date()
    let needsNotification = false
    let notificationType: 'sla_warning' | 'sla_breach' | null = null

    // Check first response SLA
    if (!ticket.first_response_at && ticket.first_response_due_at) {
      const dueDate = new Date(ticket.first_response_due_at)
      const createdDate = new Date(ticket.created_at)
      
      // Breach - past deadline
      if (dueDate < now) {
        notificationType = 'sla_breach'
        needsNotification = true
      } else {
        // Warning - less than 25% time remaining
        const totalTime = dueDate.getTime() - createdDate.getTime()
        const remainingTime = dueDate.getTime() - now.getTime()
        const percentRemaining = (remainingTime / totalTime) * 100
        
        if (percentRemaining < 25) {
          notificationType = 'sla_warning'
          needsNotification = true
        }
      }
    }

    // Check resolution SLA
    if (!ticket.resolved_at && ticket.sla_due_at && !notificationType) {
      const dueDate = new Date(ticket.sla_due_at)
      const createdDate = new Date(ticket.created_at)
      
      // Breach - past deadline
      if (dueDate < now) {
        notificationType = 'sla_breach'
        needsNotification = true
      } else {
        // Warning - less than 25% time remaining
        const totalTime = dueDate.getTime() - createdDate.getTime()
        const remainingTime = dueDate.getTime() - now.getTime()
        const percentRemaining = (remainingTime / totalTime) * 100
        
        if (percentRemaining < 25) {
          notificationType = 'sla_warning'
          needsNotification = true
        }
      }
    }

    if (!needsNotification || !notificationType) {
      return false
    }

    // Check if already notified recently (last 4 hours)
    const { data: recentNotification } = await supabaseAdmin
      .from('notification_log')
      .select('id')
      .eq('ticket_id', ticketId)
      .eq('notification_type', notificationType)
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
      .limit(1)

    if (recentNotification && recentNotification.length > 0) {
      return false // Already notified recently
    }

    // Calculate hours for message
    const dueDate = new Date(
      ticket.first_response_at ? ticket.sla_due_at! : ticket.first_response_due_at!
    )
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Send notification
    const { subject, message } = formatNotificationMessage(notificationType, {
      ticketNumber: ticket.ticket_number,
      ticketSubject: ticket.subject,
      priority: ticket.priority,
      hoursOverdue: hoursUntilDue < 0 ? Math.abs(hoursUntilDue) : undefined,
      hoursUntilDue: hoursUntilDue > 0 ? hoursUntilDue : undefined,
    })

    const payloads = await buildTicketNotificationPayloads(ticketId, notificationType, {
      subject,
      message,
    })

    if (payloads.length > 0) {
      await sendNotifications(payloads)
      return true
    }

    return false
  } catch (error) {
    console.error('[SLA Monitor] Error checking ticket:', error)
    return false
  }
}
