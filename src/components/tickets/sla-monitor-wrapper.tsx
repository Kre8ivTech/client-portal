/**
 * SLA Monitor Wrapper
 * 
 * Client component wrapper for the SLA monitoring hook
 * Enables real-time SLA monitoring in the dashboard
 */

'use client'

import { useSLAMonitor } from '@/hooks/use-sla-monitor'
import { usePathname } from 'next/navigation'

export function SLAMonitorWrapper() {
  const pathname = usePathname()
  
  // Only monitor on ticket pages
  const isTicketPage = pathname?.startsWith('/dashboard/tickets')
  
  useSLAMonitor(isTicketPage)
  
  return null // This component doesn't render anything
}
