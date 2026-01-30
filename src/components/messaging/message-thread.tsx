'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Send, Paperclip, MoreVertical, Phone, Video, Info, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface MessageThreadProps {
  conversation: any
  messages: any[]
  userId: string
  onSendMessage: (content: string) => void
}

export function MessageThread({ conversation, messages, userId, onSendMessage }: MessageThreadProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const otherParticipant = conversation?.type === 'direct' 
    ? conversation.profiles?.find((p: any) => p.id !== userId)
    : null

  const title = conversation?.type === 'direct' 
    ? otherParticipant?.name || 'User'
    : conversation?.title || 'Group Conversation'

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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
            <Video className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
