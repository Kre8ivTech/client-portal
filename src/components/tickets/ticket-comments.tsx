'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { MessageSquare, Send, Loader2, User } from 'lucide-react'
import { Database } from '@/types/database'

type Comment = Database['public']['Tables']['ticket_comments']['Row'] & {
  author?: {
    name: string | null
    avatar_url: string | null
  }
}

interface TicketCommentsProps {
  ticketId: string
  userId: string
}

export function TicketComments({ ticketId, userId }: TicketCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any
  const queryClient = useQueryClient()

  const { data: comments, isLoading } = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      // Joined profiles to get author details
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('*, author:profiles(name, avatar_url)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Comment[]
    }
  })

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`ticket-comments-${ticketId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'ticket_comments',
          filter: `ticket_id=eq.${ticketId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, queryClient, supabase])

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    const { error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        author_id: userId,
        content: newComment.trim(),
        is_internal: false
      })

    if (error) {
      console.error('Error posting comment:', error)
      alert('Failed to post comment. Please try again.')
    } else {
      setNewComment('')
    }
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6 mt-8">
      <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
        <MessageSquare className="h-5 w-5" />
        <h2>Conversation</h2>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : comments?.length === 0 ? (
          <p className="text-center text-slate-500 py-8 italic">No comments yet. Start the conversation!</p>
        ) : (
          comments?.map((comment) => (
            <div 
              key={comment.id} 
              className={`flex gap-3 ${comment.author_id === userId ? 'flex-row-reverse' : ''}`}
            >
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border overflow-hidden">
                {comment.author?.avatar_url ? (
                  <img src={comment.author.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-slate-500" />
                )}
              </div>
              <div className={`flex flex-col max-w-[80%] ${comment.author_id === userId ? 'items-end' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-700">
                    {comment.author?.name || 'Unknown User'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl text-sm ${
                  comment.author_id === userId 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white border text-slate-700 rounded-tl-none shadow-sm'
                }`}>
                  {comment.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handlePostComment} className="relative pt-2">
        <Input
          placeholder="Type your message..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="pr-12 py-6 rounded-xl border-slate-200 focus:ring-primary h-12"
          disabled={isSubmitting}
        />
        <Button 
          type="submit" 
          size="icon" 
          className="absolute right-1.5 top-[14px] h-9 w-9 rounded-lg"
          disabled={!newComment.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
