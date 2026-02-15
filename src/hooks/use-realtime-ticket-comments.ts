'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook to subscribe to real-time ticket comment changes
 * Invalidates ticket comments query when changes occur
 * @param ticketId - Optional ticket ID to filter changes
 */
export function useRealtimeTicketComments(ticketId?: string) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('ticket-comments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_comments',
          ...(ticketId && { filter: `ticket_id=eq.${ticketId}` }),
        },
        (payload: any) => {
          console.log('Ticket comment change detected:', payload)
          
          // Invalidate specific ticket comments if ticketId provided
          if (ticketId) {
            queryClient.invalidateQueries({ 
              queryKey: ['ticket-comments', ticketId] 
            })
          }
          
          // Also invalidate general ticket comments query
          queryClient.invalidateQueries({ 
            queryKey: ['ticket-comments'] 
          })

          // Invalidate the specific ticket to update comment count
          if (payload.new && 'ticket_id' in payload.new) {
            queryClient.invalidateQueries({ 
              queryKey: ['ticket', payload.new.ticket_id] 
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase, ticketId])
}
