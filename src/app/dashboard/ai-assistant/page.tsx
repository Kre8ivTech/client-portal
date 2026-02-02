'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getAIResponse } from '@/lib/actions/ai'
import { Bot, Send, User, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your AI Assistant. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await getAIResponse([...messages, userMsg])
      if (response.error || !response.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.content }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection error." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Assistant</h2>
          <p className="text-sm text-muted-foreground">
            Ask questions about troubleshooting, server management, or how to use the portal.
          </p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-sm">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex w-full",
                m.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex gap-3 max-w-[80%] rounded-2xl p-4 text-sm shadow-sm",
                  m.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-br-none" 
                    : "bg-slate-100 text-slate-800 rounded-bl-none"
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {m.role === 'user' ? <User className="h-4 w-4 opacity-70" /> : <Bot className="h-4 w-4 opacity-70" />}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start w-full">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                <Bot className="h-4 w-4 text-slate-400" />
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              className="flex-1"
              disabled={loading}
              autoFocus
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
