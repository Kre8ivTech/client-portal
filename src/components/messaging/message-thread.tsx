'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Send, Paperclip, MoreVertical, Phone, Video, Info, User, UserPlus, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/cn'
import type { Database } from '@/types/database'
import { useStaffAssignments, useAvailableStaff } from '@/hooks/use-staff-assignments'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Conversation = Database['public']['Tables']['conversations']['Row']
type Message = Database['public']['Tables']['messages']['Row']

interface MessageThreadProps {
  conversation: Conversation | undefined
  messages: Message[]
  userId: string
  onSendMessage: (content: string) => void
}

export function MessageThread({ conversation, messages, userId, onSendMessage }: MessageThreadProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Staff assignments
  const {
    assignments,
    isLoading: isLoadingAssignments,
    assignStaff,
    unassignStaff,
    isAssigning,
  } = useStaffAssignments('conversation', conversation?.id || '')

  const { data: availableStaff } = useAvailableStaff(conversation?.organization_id || '')

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight)
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    onSendMessage(input)
    setInput('')
  }

  // Note: profiles join via participant_ids doesn't work in current schema
  // participant_ids is a UUID array, not a FK relationship
  // TODO: Fix conversation query to properly join participant profiles
  const conversationWithProfiles = conversation as Conversation & {
    profiles?: Array<{ id: string; name: string | null; avatar_url: string | null }>
  }

  const otherParticipant = conversationWithProfiles?.type === 'direct'
    ? conversationWithProfiles.profiles?.find((p) => p.id !== userId)
    : null

  const title = conversationWithProfiles?.type === 'direct'
    ? otherParticipant?.name || 'User'
    : conversationWithProfiles?.title || 'Group Conversation'

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Thread Header */}
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border shadow-sm">
            <AvatarImage src={otherParticipant?.avatar_url} />
            <AvatarFallback className="bg-blue-600 text-white font-bold">
              {title.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">{title}</CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Assigned Staff Avatars */}
          {assignments && assignments.length > 0 && (
            <div className="flex items-center -space-x-2 mr-2">
              {assignments.slice(0, 3).map((assignment) => (
                <TooltipProvider key={assignment.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative group cursor-pointer">
                        <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                          <AvatarImage src={assignment.staff?.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="bg-blue-500 text-white text-xs">
                            {assignment.staff?.profiles?.name?.charAt(0) || assignment.staff?.email?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => unassignStaff(assignment.id)}
                          className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{assignment.staff?.profiles?.name || assignment.staff?.email}</p>
                      <p className="text-xs text-slate-400 capitalize">{assignment.role || 'assigned'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {assignments.length > 3 && (
                <div className="h-8 w-8 border-2 border-white shadow-sm rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">
                  +{assignments.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Assign Staff Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-slate-900"
                disabled={isAssigning}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Assign Staff</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableStaff && availableStaff.length > 0 ? (
                availableStaff
                  .filter((staff) =>
                    !assignments?.some((a) => a.staff_user_id === staff.id)
                  )
                  .map((staff) => (
                    <DropdownMenuItem
                      key={staff.id}
                      onClick={() =>
                        assignStaff({
                          staffUserId: staff.id,
                          organizationId: conversation?.organization_id || '',
                          role: 'primary',
                        })
                      }
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={staff.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-blue-500 text-white">
                            {staff.profiles?.name?.charAt(0) || staff.email?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {staff.profiles?.name || staff.email}
                          </span>
                          <span className="text-xs text-slate-400 capitalize">
                            {staff.role?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
              ) : (
                <DropdownMenuItem disabled>No staff available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-4" />

          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
            <Video className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full pr-4" viewportRef={scrollRef}>
          <div className="p-4 space-y-6">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Avatar className="h-20 w-20 border-4 border-slate-50 shadow-md">
                <AvatarImage src={otherParticipant?.avatar_url} />
                <AvatarFallback className="text-2xl bg-slate-100 text-slate-400">
                  <User size={40} />
                </AvatarFallback>
              </Avatar>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500 max-w-[200px]">
                  Take a look back at the beginning of your conversation with {title}.
                </p>
                <Badge variant="outline" className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Joined {formatDistanceToNow(new Date(conversation?.created_at || Date.now()))} ago
                </Badge>
              </div>
            </div>

            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === userId
              const showAvatar = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id

              return (
                <div key={idx} className={cn(
                  "flex gap-3",
                  isMe ? "flex-row-reverse" : "flex-row"
                )}>
                  <div className="shrink-0">
                    {!isMe && showAvatar ? (
                      <Avatar className="h-8 w-8 border shadow-sm">
                        <AvatarImage src={otherParticipant?.avatar_url} />
                        <AvatarFallback className="text-[10px] bg-blue-500 text-white">
                          {title[0]}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8" />
                    )}
                  </div>
                  <div className={cn(
                    "flex flex-col max-w-[75%] space-y-1",
                    isMe ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "p-3 rounded-2xl text-sm shadow-sm",
                      isMe 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : "bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-slate-400 px-1 font-medium">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <CardFooter className="p-4 border-t bg-slate-50/50">
        <div className="flex w-full items-center gap-2">
          <Button variant="ghost" size="icon" className="text-slate-400 shrink-0">
            <Paperclip className="h-5 w-5" />
          </Button>
          <div className="flex-1 relative">
            <Input 
              placeholder="Type your message..." 
              className="pr-12 bg-white border-slate-200 h-10 ring-offset-blue-600"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button 
              size="icon" 
              className="absolute right-1 top-1 h-8 w-8 bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardFooter>
    </div>
  )
}
