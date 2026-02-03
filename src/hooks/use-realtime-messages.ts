'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook to subscribe to real-time message changes
 * Invalidates conversations and messages queries when changes occur
 * @param conversationId - Optional conversation ID to filter changes
 */
export function useRealtimeMessages(conversationId?: string) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          ...(conversationId && { filter: `conversation_id=eq.${conversationId}` }),
        },
        (payload) => {
          console.log('Message change detected:', payload)
          
          // Invalidate specific conversation messages if conversationId provided
          if (conversationId) {
            queryClient.invalidateQueries({ 
              queryKey: ['messages', conversationId] 
            })
          }
          
          // Invalidate all messages queries
          queryClient.invalidateQueries({ 
            queryKey: ['messages'] 
          })

          // Invalidate conversations list to update last message
          queryClient.invalidateQueries({ 
            queryKey: ['conversations'] 
          })

          // Invalidate specific conversation if we have the ID
          if (payload.new && 'conversation_id' in payload.new) {
            queryClient.invalidateQueries({ 
              queryKey: ['conversation', payload.new.conversation_id] 
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase, conversationId])
}

/**
 * Hook to subscribe to real-time conversation changes
 * Invalidates conversations queries when changes occur
 */
export function useRealtimeConversations() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('Conversation change detected:', payload)
          
          // Invalidate conversations list
          queryClient.invalidateQueries({ 
            queryKey: ['conversations'] 
          })

          // Invalidate specific conversation if we have the ID
          if (payload.new && 'id' in payload.new) {
            queryClient.invalidateQueries({ 
              queryKey: ['conversation', payload.new.id] 
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase])
}
