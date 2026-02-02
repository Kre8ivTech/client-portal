/**
 * Client-side SLA Monitoring Hook
 * 
 * Monitors SLA status in the browser and triggers server-side checks
 * when tickets are at risk or breaching SLA
 */

'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Monitor SLA status for active tickets
 * Triggers server-side notifications when tickets need attention
 */
export function useSLAMonitor(enabled: boolean = true) {
  const supabase = createClient()
  const lastCheckRef = useRef<number>(Date.now())

  const { data: atRiskTickets } = useQuery({
    queryKey: ['sla-at-risk'],
    queryFn: async () => {
      // Get tickets that might need SLA notifications
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, first_response_due_at, sla_due_at, first_response_at, resolved_at, status')
        .in('status', ['new', 'open', 'in_progress', 'pending_client'])
        .or('first_response_at.is.null,resolved_at.is.null')

      if (error) {
        console.error('Failed to fetch tickets for SLA monitoring:', error)
        return []
      }

      const now = new Date()
      const atRisk: string[] = []

      tickets?.forEach((ticket) => {
        // Check first response SLA
        if (!ticket.first_response_at && ticket.first_response_due_at) {
          const dueDate = new Date(ticket.first_response_due_at)
          const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
          
          // At risk if < 2 hours or overdue
          if (hoursUntilDue < 2) {
            atRisk.push(ticket.id)
          }
        }

        // Check resolution SLA
        if (!ticket.resolved_at && ticket.sla_due_at) {
          const dueDate = new Date(ticket.sla_due_at)
          const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
          
          // At risk if < 4 hours or overdue
          if (hoursUntilDue < 4 && !atRisk.includes(ticket.id)) {
            atRisk.push(ticket.id)
          }
        }
      })

      return atRisk
    },
    enabled,
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    refetchIntervalInBackground: true,
  })

  // Trigger server-side SLA check when at-risk tickets are detected
  useEffect(() => {
    if (!atRiskTickets || atRiskTickets.length === 0) return

    // Only check once per hour to avoid spam
    const now = Date.now()
    if (now - lastCheckRef.current < 60 * 60 * 1000) {
      return
    }

    lastCheckRef.current = now

    // Trigger server-side SLA check
    fetch('/api/notifications/sla-check', {
      method: 'GET',
    }).catch((error) => {
      console.error('Failed to trigger SLA check:', error)
    })
  }, [atRiskTickets])

  return {
    atRiskTickets: atRiskTickets || [],
    isMonitoring: enabled,
  }
}
