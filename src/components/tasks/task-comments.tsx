'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Loader2,
  MessageSquare,
  Send,
  MoreHorizontal,
  Trash2,
  Reply,
  Lock,
} from 'lucide-react'

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

interface TaskCommentsProps {
  taskId: string
  comments: TaskComment[]
  currentUserId: string
  canEdit: boolean
}

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

export function TaskComments({
  taskId,
  comments,
  currentUserId,
  canEdit,
}: TaskCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInternal, setIsInternal] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const router = useRouter()

  // Organize comments into threads
  const topLevelComments = comments.filter((c) => !c.parent_comment_id)
  const repliesMap: Record<string, TaskComment[]> = {}
  comments.forEach((c) => {
    if (c.parent_comment_id) {
      if (!repliesMap[c.parent_comment_id]) {
        repliesMap[c.parent_comment_id] = []
      }
      repliesMap[c.parent_comment_id].push(c)
    }
  })

  async function handleSubmitComment() {
    const content = newComment.trim()
    if (!content) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          parent_comment_id: replyingTo,
          is_internal: isInternal,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to post comment')
      }

      setNewComment('')
      setReplyingTo(null)
      setIsInternal(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to post comment:', error)
      alert('Failed to post comment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return

    setActionId(commentId)
    try {
      const response = await fetch(
        `/api/tasks/${taskId}/comments/${commentId}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to delete comment')
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to delete comment:', error)
      alert('Failed to delete comment. Please try again.')
    } finally {
      setActionId(null)
    }
  }

  function renderComment(comment: TaskComment, isReply = false) {
    const authorName = comment.created_by.name ?? 'Unknown'
    const initials = authorName.slice(0, 2).toUpperCase()
    const isOwn = comment.created_by.id === currentUserId
    const replies = repliesMap[comment.id] ?? []
    const isActioning = actionId === comment.id

    return (
      <div key={comment.id} className={isReply ? 'ml-10 mt-3' : ''}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={comment.created_by.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">
                {authorName}
              </span>
              <span className="text-xs text-slate-400">
                {formatRelativeTime(comment.created_at)}
              </span>
              {comment.is_internal && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 bg-purple-50 text-purple-600 border-purple-200"
                >
                  <Lock className="h-2.5 w-2.5 mr-1" />
                  Internal
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
              {comment.content}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-slate-400 hover:text-slate-600"
                  onClick={() =>
                    setReplyingTo(
                      replyingTo === comment.id ? null : comment.id
                    )
                  }
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              )}
              {isOwn && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400"
                      disabled={isActioning}
                    >
                      {isActioning ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-3 w-3" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Reply input */}
            {replyingTo === comment.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[60px] text-sm"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <Lock className="h-3 w-3" />
                    Internal (team only)
                  </label>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReplyingTo(null)
                        setNewComment('')
                        setIsInternal(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Replies */}
            {replies.length > 0 && (
              <div className="space-y-3 mt-3">
                {replies.map((reply) => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
        <CardDescription>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'} on
          this task
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New comment input (top-level) */}
        {!replyingTo && (
          <div className="space-y-3">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="min-h-[80px]"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <Lock className="h-4 w-4" />
                Internal (team only)
              </label>
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
                size="sm"
                className="gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Post Comment
              </Button>
            </div>
          </div>
        )}

        {/* Comments list */}
        {topLevelComments.length > 0 ? (
          <div className="space-y-6">
            {topLevelComments.map((c) => renderComment(c))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <MessageSquare className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No comments yet
            </h3>
            <p className="text-slate-500 text-sm">
              Start a discussion about this task.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
