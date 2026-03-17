'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// useRealtimePresence removed - was unused. Restore from git history if needed.

/**
 * Hook to broadcast and receive real-time events in a channel
 * Useful for typing indicators, cursor positions, etc.
 * @param channelName - Name of the broadcast channel to join
 * @param onEvent - Callback when an event is received
 */
export function useRealtimeBroadcast<T = any>(
  channelName: string,
  eventType: string,
  onEvent?: (payload: T) => void
) {
  const supabase = useMemo(() => createClient(), [])
  const channelRef = useRef<any>(null)

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: eventType }, (payload: any) => {
        onEvent?.(payload.payload as T)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, channelName, eventType])

  const broadcast = useCallback(async (payload: T) => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: eventType,
        payload,
      })
    }
  }, [eventType])

  return { broadcast }
}
