'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PresenceState {
  [userId: string]: Array<{
    user_id: string
    online_at: string
    presence_ref: string
  }>
}

/**
 * Hook to track user presence in a specific channel
 * Returns the current presence state showing who is online
 * @param channelName - Name of the presence channel to join
 * @param userId - Current user's ID
 */
export function useRealtimePresence(channelName: string, userId?: string) {
  const supabase = createClient()
  const [presenceState, setPresenceState] = useState<PresenceState>({})
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])

  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>()
        setPresenceState(state)
        setOnlineUsers(Object.keys(state))
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [supabase, channelName, userId])

  return { presenceState, onlineUsers }
}

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
  const supabase = createClient()

  useEffect(() => {
    if (!onEvent) return

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: eventType }, (payload) => {
        onEvent(payload.payload as T)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, channelName, eventType, onEvent])

  const broadcast = async (payload: T) => {
    const channel = supabase.channel(channelName)
    await channel.send({
      type: 'broadcast',
      event: eventType,
      payload,
    })
  }

  return { broadcast }
}
