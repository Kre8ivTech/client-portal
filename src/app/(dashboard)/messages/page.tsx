'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ConversationList } from '@/components/messaging/conversation-list'
import { MessageThread } from '@/components/messaging/message-thread'
import { Card } from '@/components/ui/card'
import { Loader2, MessageSquare } from 'lucide-react'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const supabase = createClient() as any

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Fetch conversations
      const { data: convs } = await supabase
        .from('conversations')
        .select(`
          *,
          profiles:participant_ids (
            id,
            name,
            avatar_url
          )
        `)
        .order('last_message_at', { ascending: false })

      setConversations(convs || [])
      setLoading(false)

      // Subscribe to conversation updates
      const channel = supabase
        .channel('conversations_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'conversations' 
        }, () => {
          // Re-fetch on change for simplicity, or update state manually
          refreshConversations()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    init()
  }, [])

  useEffect(() => {
    if (!activeId) return

    async function fetchMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeId)
        .order('created_at', { ascending: true })

      setMessages(data || [])
    }

    fetchMessages()

    // Subscribe to new messages for this conversation
    const channel = supabase
      .channel(`room:${activeId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${activeId}`
      }, (payload: any) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeId])

  async function refreshConversations() {
    const { data } = await supabase
      .from('conversations')
      .select(`
        *,
        profiles:participant_ids (
          id,
          name,
          avatar_url
        )
      `)
      .order('last_message_at', { ascending: false })
    setConversations(data || [])
  }

  async function handleSendMessage(content: string) {
    if (!activeId || !userId) return
    setSendError(null)
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeId,
        sender_id: userId,
        content,
        message_type: 'text'
      })
    if (error) setSendError(error.message)
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  const activeConversation = conversations.find(c => c.id === activeId)

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-10rem)] border border-slate-200 rounded-3xl overflow-hidden shadow-2xl bg-white flex">
      <div className="w-80 shrink-0 h-full border-r bg-slate-50/50">
        <ConversationList 
          conversations={conversations} 
          activeId={activeId || undefined} 
          onSelect={setActiveId}
          userId={userId || ''}
        />
      </div>

      <div className="flex-1 h-full bg-slate-50">
        {activeId ? (
          <MessageThread 
            conversation={activeConversation}
            messages={messages}
            userId={userId || ''}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-center p-8 animate-in fade-in zoom-in duration-500">
            <div className="h-20 w-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-inner">
              <MessageSquare size={40} />
            </div>
            <div className="max-w-sm space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Select a Conversation</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Connect with our team or your account manager for instant support and updates on your projects.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
