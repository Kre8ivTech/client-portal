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
  const supabase = createClient() as any

  useEffect(() => {
    let isActive = true
    let channel: any = null

    async function init() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!isActive) return
      if (authError || !user) {
        setLoading(false)
        return
      }

      setUserId(user.id)

      const convs = await fetchConversations()
      if (!isActive) return
      setConversations(convs)
      setLoading(false)

      channel = supabase
        .channel('conversations_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'conversations' 
        }, () => {
          refreshConversations()
        })
        .subscribe()

      if (!isActive && channel) {
        supabase.removeChannel(channel)
      }
    }

    init()

    return () => {
      isActive = false
      if (channel) supabase.removeChannel(channel)
    }
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

  async function fetchConversations() {
    const { data: convs, error } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false })

    if (error || !convs) {
      return []
    }

    const participantIds = Array.from(
      new Set(convs.flatMap((conv) => conv.participant_ids ?? []))
    )

    if (participantIds.length === 0) {
      return convs.map((conv) => ({ ...conv, profiles: [] }))
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', participantIds)

    if (profilesError || !profiles) {
      return convs.map((conv) => ({ ...conv, profiles: [] }))
    }

    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))

    return convs.map((conv) => ({
      ...conv,
      profiles: (conv.participant_ids ?? [])
        .map((id: string) => profilesById.get(id))
        .filter(Boolean),
    }))
  }

  async function refreshConversations() {
    const convs = await fetchConversations()
    setConversations(convs)
  }

  async function handleSendMessage(content: string) {
    if (!activeId || !userId) return

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeId,
        sender_id: userId,
        content,
        message_type: 'text'
      })

    if (error) {
      console.error('Error sending message:', error)
    }
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
