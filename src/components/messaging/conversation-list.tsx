'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, MessageSquare, PenSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRealtimeConversations } from '@/hooks/use-realtime-messages'
import { cn } from '@/lib/cn'

interface ConversationParticipant {
  user_id: string
  last_read_at: string | null
  is_muted: boolean
  user: {
    id: string
    email: string
    role: string
    profiles: {
      name: string | null
      avatar_url: string | null
      presence_status: string | null
    } | null
  } | null
}

interface ConversationListProps {
  conversations: any[]
  activeId?: string
  onSelect: (id: string) => void
  userId: string
  onNewConversation?: () => void
}

export function ConversationList({ conversations, activeId, onSelect, userId, onNewConversation }: ConversationListProps) {
  const [search, setSearch] = useState('')

  // Subscribe to real-time conversation updates
  useRealtimeConversations()

  const filteredConversations = conversations.filter(conv => {
    const title = getConversationTitle(conv, userId).toLowerCase()
    return title.includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full border-r bg-slate-50/30">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Messages</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
              {conversations.length}
            </Badge>
            {onNewConversation && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={onNewConversation}
                title="New conversation"
              >
                <PenSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 bg-white border-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <MessageSquare className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl transition-all duration-200 flex gap-3 group relative",
                  activeId === conv.id 
                    ? "bg-white shadow-sm border border-slate-100 ring-1 ring-slate-100" 
                    : "hover:bg-slate-100/50"
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarImage src={getConversationAvatar(conv, userId)} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
                      {getConversationInitials(conv, userId)}
                    </AvatarFallback>
                  </Avatar>
                  {isOnline(conv, userId) && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-start">
                    <p className={cn(
                      "text-sm font-bold truncate",
                      activeId === conv.id ? "text-blue-600" : "text-slate-900"
                    )}>
                      {getConversationTitle(conv, userId)}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate font-medium">
                    {conv.last_message_content || "No messages yet"}
                  </p>
                </div>

                {conv.unread_count > 0 && (
                  <Badge className="absolute right-3 bottom-3 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px] bg-blue-600">
                    {conv.unread_count}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function getOtherParticipant(conv: any, userId: string) {
  // Try new structure first (conversation_participants)
  if (conv.conversation_participants) {
    const other = conv.conversation_participants.find(
      (p: ConversationParticipant) => p.user_id !== userId
    )
    if (other?.user) {
      return {
        id: other.user.id,
        name: other.user.profiles?.name || other.user.email?.split('@')[0],
        avatar_url: other.user.profiles?.avatar_url,
        presence_status: other.user.profiles?.presence_status,
      }
    }
  }

  // Try transformed structure (participants)
  if (conv.participants) {
    const other = conv.participants.find((p: any) => p.id !== userId && p.userId !== userId)
    if (other) {
      return {
        id: other.id || other.userId,
        name: other.profiles?.name || other.name || other.email?.split('@')[0],
        avatar_url: other.profiles?.avatar_url || other.avatar_url,
        presence_status: other.profiles?.presence_status || other.presence_status,
      }
    }
  }

  // Fallback to old structure (profiles from participant_ids)
  if (conv.profiles) {
    const other = conv.profiles.find((p: any) => p.id !== userId)
    if (other) {
      return {
        id: other.id,
        name: other.name,
        avatar_url: other.avatar_url,
        presence_status: null,
      }
    }
  }

  return null
}

function getConversationTitle(conv: any, userId: string) {
  if (conv.type === 'direct') {
    const other = getOtherParticipant(conv, userId)
    return other?.name || 'User'
  }
  return conv.title || 'Group Conversation'
}

function getConversationAvatar(conv: any, userId: string) {
  if (conv.type === 'direct') {
    const other = getOtherParticipant(conv, userId)
    return other?.avatar_url
  }
  return undefined
}

function getConversationInitials(conv: any, userId: string) {
  const title = getConversationTitle(conv, userId)
  return title.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
}

function isOnline(conv: any, userId: string) {
  if (conv.type === 'direct') {
    const other = getOtherParticipant(conv, userId)
    return other?.presence_status === 'online'
  }
  return false
}

