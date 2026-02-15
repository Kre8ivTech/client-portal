'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Loader2, MessageSquareText, Trash2 } from 'lucide-react'

type TaskComment = {
  id: string
  task_id: string
  content: string
  is_internal: boolean
  parent_comment_id: string | null
  created_at: string
  updated_at: string
  created_by: {
    id: string
    name: string | null
    avatar_url: string | null
  }
}

interface TaskFeedbackProps {
  taskId: string
  comments: TaskComment[]
  currentUserId: string
}

const FEEDBACK_PREFIX = '[Feedback]'

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function isFeedbackComment(comment: TaskComment): boolean {
  return (
    !comment.parent_comment_id &&
    !comment.is_internal &&
    comment.content.trim().toLowerCase().startsWith(FEEDBACK_PREFIX.toLowerCase())
  )
}

function extractFeedbackText(content: string): string {
  return content.replace(/^\[feedback\]\s*/i, '').trim()
}

export function TaskFeedback({ taskId, comments, currentUserId }: TaskFeedbackProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const feedbackEntries = useMemo(
    () =>
      comments
        .filter(isFeedbackComment)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [comments]
  )

  async function handleSubmitFeedback() {
    const message = feedbackText.trim()
    if (!message) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `${FEEDBACK_PREFIX} ${message}`,
          parent_comment_id: null,
          is_internal: false,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }

      setFeedbackText('')
      toast({
        title: 'Feedback added',
        description: 'Your feedback was added to this task.',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Failed to submit feedback',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteFeedback(commentId: string) {
    setActionId(commentId)
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete feedback')
      }
      toast({
        title: 'Feedback removed',
      })
      router.refresh()
    } catch {
      toast({
        title: 'Failed to delete feedback',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setActionId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
        <CardDescription>
          Capture client or team feedback as structured entries on this task.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Add actionable feedback for this task..."
            className="min-h-[96px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmitFeedback}
              disabled={isSubmitting || feedbackText.trim().length === 0}
              size="sm"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Feedback
            </Button>
          </div>
        </div>

        {feedbackEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <MessageSquareText className="mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm text-slate-500">No feedback entries yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbackEntries.map((entry) => {
              const name = entry.created_by.name ?? 'Unknown'
              const initials = name.slice(0, 2).toUpperCase()
              const isOwner = entry.created_by.id === currentUserId
              const isActioning = actionId === entry.id

              return (
                <div key={entry.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={entry.created_by.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-xs text-slate-400">
                        {formatRelativeTime(entry.created_at)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Feedback
                      </Badge>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-600"
                        onClick={() => handleDeleteFeedback(entry.id)}
                        disabled={isActioning}
                      >
                        {isActioning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {extractFeedbackText(entry.content)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
