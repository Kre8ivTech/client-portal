'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeTicketComments } from '@/hooks/use-realtime-ticket-comments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Image from 'next/image'
import { format } from 'date-fns'
import { MessageSquare, Send, Loader2, User, AlertCircle } from 'lucide-react'
import { Database } from '@/types/database'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

type Comment = Database['public']['Tables']['ticket_comments']['Row'] & {
  author?: {
    name: string | null
    avatar_url: string | null
  }
}

interface TicketCommentsProps {
  ticketId: string
  userId: string
  userRole?: string
}

export function TicketComments({ ticketId, userId, userRole }: TicketCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const supabase = createClient() as any
  const queryClient = useQueryClient()

  const isStaff = userRole === 'super_admin' || userRole === 'staff'

  // Subscribe to real-time comment updates using our hook
  useRealtimeTicketComments(ticketId)

  const { data: comments, isLoading, error: queryError } = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      // Join with user_profiles view to get author details
      // ticket_comments.author_id -> users.id, then users joins profiles
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('*, author:user_profiles!author_id(name, avatar_url)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching ticket comments:', error)
        throw error
      }
      return data as Comment[]
    }
  })

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
        is_internal: isInternal
      })

    if (error) {
      setPostError(error.message || 'Failed to post comment. Please try again.')
    } else {
      setNewComment('')
      setIsInternal(false)
      setPostError(null)
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
        ) : queryError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Comments</AlertTitle>
            <AlertDescription>
              {queryError instanceof Error ? queryError.message : 'Failed to load comments. Please refresh the page.'}
            </AlertDescription>
          </Alert>
        ) : comments?.length === 0 ? (
          <p className="text-center text-slate-500 py-8 italic">No comments yet. Start the conversation!</p>
        ) : (
          comments?.map((comment) => (
            <div 
              key={comment.id} 
              className={`flex gap-3 ${comment.author_id === userId ? 'flex-row-reverse' : ''}`}
            >
              <div className="relative h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border overflow-hidden">
                {comment.author?.avatar_url ? (
                  <Image src={comment.author.avatar_url} alt="" fill className="object-cover" sizes="32px" />
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
                    {comment.created_at ? format(new Date(comment.created_at), 'MMM d, h:mm a') : '—'}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl text-sm ${
                  comment.is_internal
                    ? 'bg-amber-50 border-amber-200 text-amber-900 border'
                    : comment.author_id === userId 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white border text-slate-700 rounded-tl-none shadow-sm'
                }`}>
                  {comment.is_internal && (
                    <div className="text-[10px] font-bold uppercase mb-1 flex items-center gap-1 text-amber-600">
                      <AlertCircle className="h-3 w-3" />
                      Internal Note
                    </div>
                  )}
                  {comment.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {postError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{postError}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={handlePostComment} className="space-y-4 pt-2">
        <div className="relative">
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
            className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg"
            disabled={!newComment.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {isStaff && (
          <div className="flex items-center gap-2 px-1">
            <Switch 
              id="internal-note" 
              checked={isInternal} 
              onCheckedChange={setIsInternal} 
            />
            <Label htmlFor="internal-note" className="text-sm font-medium text-slate-600 cursor-pointer">
              Mark as internal note (Staff only)
            </Label>
          </div>
        )}
      </form>
    </div>
  )
}
