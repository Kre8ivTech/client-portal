'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface InboxWrapperProps {
  children: React.ReactNode
}

export function InboxWrapper({ children }: InboxWrapperProps) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to changes in conversations, tickets, invoices, and contracts
    const channel = supabase
      .channel('inbox-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, () => {
        router.refresh()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ticket_comments',
      }, () => {
        router.refresh()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
      }, () => {
        router.refresh()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invoices',
      }, () => {
        router.refresh()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contracts',
      }, () => {
        router.refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  return <>{children}</>
}
