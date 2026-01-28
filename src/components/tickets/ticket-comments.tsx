'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Database } from '@/types/database'

type Comment = Database['public']['Tables']['ticket_comments']['Row'] & {
  created_by: {
    name: string | null
    avatar_url: string | null
  }
}

interface TicketCommentsProps {
  ticketId: string
}

export function TicketComments({ ticketId }: TicketCommentsProps) {
  const [content, setContent] = useState('')
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch comments
  const { data: comments, isLoading } = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('*, created_by:profiles(name, avatar_url)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as unknown as Comment[]
    },
  })

  // Add comment mutation
  const { mutate: addComment, isPending } = useMutation({
    mutationFn: async (content: string) => {
      // In a real app we'd get the user ID from auth context, 
      // but the API handles it securely. 
      // For client-side optimisic updates we might need it.
      
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) throw new Error('Failed to add comment')
      return response.json()
    },
    onSuccess: () => {
      setContent('')
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    addComment(content)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Discussion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : comments?.length === 0 ? (
            <p className="text-center text-slate-500 py-4 italic">No comments yet.</p>
          ) : (
            comments?.map((comment) => (
              <div key={comment.id} className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-medium shrink-0">
                  {comment.created_by?.avatar_url ? (
                    <img src={comment.created_by.avatar_url} alt="" className="rounded-full h-full w-full object-cover" />
                  ) : (
                    comment.created_by?.name?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">
                      {comment.created_by?.name || 'Unknown User'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                    {comment.is_internal && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-medium">Internal Note</span>
                    )}
                  </div>
                  <div className="text-slate-700 text-sm whitespace-pre-wrap">
                    {comment.content}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            placeholder="Add a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] pr-12 resize-none"
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (content.trim()) addComment(content);
                }
            }}
          />
          <div className="absolute bottom-3 right-3">
             <Button 
                size="icon" 
                className="h-8 w-8 rounded-full" 
                type="submit" 
                disabled={!content.trim() || isPending}
            >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
             </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
