'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'

export interface ChatSession {
  id: string
  status: 'waiting' | 'active' | 'ended' | 'missed'
  visitor_id?: string
  visitor_name: string
  visitor_email: string
  agent_id?: string
  queue_position?: number
  pre_chat_data?: any
  started_at: string
  accepted_at?: string
  ended_at?: string
}

export interface ChatMessage {
  id: string
  session_id: string
  sender_type: 'visitor' | 'agent' | 'system' | 'bot'
  sender_id?: string
  content: string
  is_internal: boolean
  created_at: string
}

/**
 * Hook for managing live chat sessions (visitor side)
 * Handles session creation, messaging, and real-time updates
 */
export function useLiveChat(visitorName: string, visitorEmail: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Create new chat session
  const createSession = useMutation({
    mutationFn: async (preChatData?: any) => {
      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .insert({
          visitor_name: visitorName,
          visitor_email: visitorEmail,
          pre_chat_data: preChatData,
          status: 'waiting',
        })
        .select()
        .single()

      if (error) throw error
      return data as ChatSession
    },
    onSuccess: (data) => {
      setSessionId(data.id)
      queryClient.invalidateQueries({ queryKey: ['chat-session', data.id] })
    },
  })

  // Get current session
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['chat-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null

      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) throw error
      return data as ChatSession
    },
    enabled: !!sessionId,
  })

  // Get messages for session
  const { data: messages, isLoading: isMessagesLoading } = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      if (!sessionId) return []

      const { data, error } = await (supabase as any)
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as ChatMessage[]
    },
    enabled: !!sessionId,
    initialData: [],
  })

  // Send message
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId) throw new Error('No active session')

      const { data, error } = await (supabase as any)
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'visitor',
          content,
          is_internal: false,
        })
        .select()
        .single()

      if (error) throw error
      return data as ChatMessage
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] })
    },
  })

  // End session
  const endSession = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('No active session')

      const { error } = await (supabase as any)
        .from('chat_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-session', sessionId] })
      setSessionId(null)
    },
  })

  // Real-time subscription for messages
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`chat-messages-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, queryClient, supabase])

  // Real-time subscription for session status
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`chat-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-session', sessionId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, queryClient, supabase])

  return {
    session,
    messages,
    isLoading: isSessionLoading || isMessagesLoading,
    createSession: createSession.mutate,
    isCreatingSession: createSession.isPending,
    sendMessage: sendMessage.mutate,
    isSendingMessage: sendMessage.isPending,
    endSession: endSession.mutate,
    isEndingSession: endSession.isPending,
  }
}

/**
 * Hook for managing live chat as an agent
 * Handles accepting sessions, sending messages, and transferring
 */
export function useAgentChat(agentId: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get waiting sessions (queue)
  const { data: waitingSessions } = useQuery({
    queryKey: ['chat-sessions', 'waiting'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .select('*')
        .eq('status', 'waiting')
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as ChatSession[]
    },
    refetchInterval: 5000, // Poll every 5 seconds
  })

  // Get agent's active sessions
  const { data: activeSessions } = useQuery({
    queryKey: ['chat-sessions', 'active', agentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'active')
        .order('accepted_at', { ascending: false })

      if (error) throw error
      return data as ChatSession[]
    },
    refetchInterval: 5000,
  })

  // Accept a chat session
  const acceptSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .update({
          agent_id: agentId,
          status: 'active',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('status', 'waiting')
        .select()
        .single()

      if (error) throw error
      return data as ChatSession
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })

  // Send message as agent
  const sendAgentMessage = useMutation({
    mutationFn: async ({
      sessionId,
      content,
      isInternal = false,
    }: {
      sessionId: string
      content: string
      isInternal?: boolean
    }) => {
      const { data, error } = await (supabase as any)
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'agent',
          sender_id: agentId,
          content,
          is_internal: isInternal,
        })
        .select()
        .single()

      if (error) throw error
      return data as ChatMessage
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['chat-messages', variables.sessionId],
      })
    },
  })

  // End session as agent
  const endAgentSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await (supabase as any)
        .from('chat_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })

  // Real-time subscription for new waiting sessions
  useEffect(() => {
    const channel = supabase
      .channel('chat-sessions-waiting')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_sessions',
          filter: 'status=eq.waiting',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-sessions', 'waiting'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase])

  return {
    waitingSessions,
    activeSessions,
    acceptSession: acceptSession.mutate,
    isAcceptingSession: acceptSession.isPending,
    sendMessage: sendAgentMessage.mutate,
    isSendingMessage: sendAgentMessage.isPending,
    endSession: endAgentSession.mutate,
    isEndingSession: endAgentSession.isPending,
  }
}
