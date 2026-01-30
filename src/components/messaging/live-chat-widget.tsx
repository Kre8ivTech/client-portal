'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, X, Send, Minus, Maximize2, Loader2, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function LiveChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<any[]>([
    { id: '1', type: 'system', content: 'Support agent joined the chat.' },
    { id: '2', type: 'agent', content: 'Hi there! How can we help you today?' }
  ])
  const [input, setInput] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const toggleChat = () => {
    if (!isOpen) {
      setIsConnecting(true)
      setTimeout(() => setIsConnecting(false), 1000)
    }
    setIsOpen(!isOpen)
    setIsMinimized(false)
  }

  const handleSend = () => {
    if (!input.trim()) return
    const newMsg = { id: Date.now().toString(), type: 'visitor', content: input }
    setMessages([...messages, newMsg])
    setInput('')
    
    // Simulate agent reply
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        type: 'agent', 
        content: 'Thanks for your message! An agent will be with you shortly.' 
      }])
    }, 1500)
  }

  if (!isOpen) {
    return (
      <Button 
        onClick={toggleChat}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 z-50 animate-bounce"
      >
        <MessageCircle size={28} />
      </Button>
    )
  }

  return (
    <div className={cn(
      "fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 z-50 overflow-hidden transition-all duration-300",
      isMinimized ? "h-16" : "h-[500px]"
    )}>
      {/* Header */}
      <CardHeader className="p-4 bg-slate-900 text-white flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center font-bold">
              KT
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold">Live Support</CardTitle>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Usually replies in minutes</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 size={16} /> : <Minus size={16} />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={toggleChat}>
            <X size={16} />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <>
          {/* Chat Content */}
          <CardContent className="p-0 h-[calc(500px-8rem)]">
            {isConnecting ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                <p className="text-sm font-medium">Connecting to secure chat...</p>
              </div>
            ) : (
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn(
                      "flex",
                      msg.type === 'visitor' ? "justify-end" : "justify-start"
                    )}>
                      {msg.type === 'system' ? (
                        <div className="w-full text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                            {msg.content}
                          </span>
                        </div>
                      ) : (
                        <div className={cn(
                          "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                          msg.type === 'visitor' 
                            ? "bg-blue-600 text-white rounded-tr-none" 
                            : "bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200"
                        )}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>

          {/* Footer */}
          <CardFooter className="p-4 border-t bg-slate-50/50">
            <div className="flex w-full items-center gap-2">
              <Input 
                placeholder="Type your message..." 
                className="bg-white border-slate-200 h-10 pr-10"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <Button 
                size="icon" 
                className="shrink-0 h-10 w-10 bg-blue-600 hover:bg-blue-700 shadow-md"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <Send size={18} />
              </Button>
            </div>
            <div className="absolute bottom-1 right-4">
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Powered by KT-Portal</p>
            </div>
          </CardFooter>
        </>
      )}
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
