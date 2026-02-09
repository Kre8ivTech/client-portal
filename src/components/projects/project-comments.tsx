'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  Pin,
  PinOff,
  Reply,
} from 'lucide-react'

type ProjectComment = {
  id: string
  content: string
  is_pinned: boolean
  parent_comment_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  author?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectCommentsProps {
  projectId: string
  comments: ProjectComment[]
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

export function ProjectComments({
  projectId,
  comments,
  currentUserId,
  canEdit,
}: ProjectCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Separate pinned and regular comments, and organize threads
  const pinnedComments = comments.filter((c) => c.is_pinned && !c.parent_comment_id)
  const topLevelComments = comments.filter((c) => !c.is_pinned && !c.parent_comment_id)
  const repliesMap: Record<string, ProjectComment[]> = {}
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
      const { error } = await supabase.from('project_comments').insert({
        project_id: projectId,
        content,
        parent_comment_id: replyingTo,
        created_by: currentUserId,
      })

      if (error) throw error

      setNewComment('')
      setReplyingTo(null)
      router.refresh()
    } catch (error) {
      console.error('Failed to post comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return

    setActionId(commentId)
    try {
      const { error } = await supabase
        .from('project_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to delete comment:', error)
    } finally {
      setActionId(null)
    }
  }

  async function handleTogglePin(commentId: string, currentlyPinned: boolean) {
    setActionId(commentId)
    try {
      const { error } = await supabase
        .from('project_comments')
        .update({ is_pinned: !currentlyPinned })
        .eq('id', commentId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    } finally {
      setActionId(null)
    }
  }

  function renderComment(comment: ProjectComment, isReply = false) {
    const authorName =
      comment.author?.profiles?.name ?? comment.author?.email ?? 'Unknown'
    const initials = authorName.slice(0, 2).toUpperCase()
    const isOwn = comment.created_by === currentUserId
    const replies = repliesMap[comment.id] ?? []
    const isActioning = actionId === comment.id

    return (
      <div key={comment.id} className={isReply ? 'ml-10 mt-3' : ''}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={comment.author?.profiles?.avatar_url ?? undefined} />
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
              {comment.is_pinned && (
                <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-600 border-amber-200">
                  <Pin className="h-2.5 w-2.5 mr-1" />
                  Pinned
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
              {(isOwn || canEdit) && (
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
                    {canEdit && !isReply && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleTogglePin(comment.id, comment.is_pinned)
                        }
                      >
                        {comment.is_pinned ? (
                          <>
                            <PinOff className="mr-2 h-4 w-4" /> Unpin
                          </>
                        ) : (
                          <>
                            <Pin className="mr-2 h-4 w-4" /> Pin
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {isOwn && (
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Reply input */}
            {replyingTo === comment.id && (
              <div className="mt-3 flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[60px] text-sm"
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => {
                      setReplyingTo(null)
                      setNewComment('')
                    }}
                  >
                    X
                  </Button>
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
        <CardTitle>Comments & Messages</CardTitle>
        <CardDescription>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'} in this project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New comment input (top-level) */}
        {!replyingTo && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment or message..."
                className="min-h-[80px]"
              />
              <div className="flex justify-end mt-2">
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
          </div>
        )}

        {/* Pinned comments */}
        {pinnedComments.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Pinned
            </h4>
            <div className="space-y-4 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
              {pinnedComments.map((c) => renderComment(c))}
            </div>
          </div>
        )}

        {/* Regular comments */}
        {topLevelComments.length > 0 ? (
          <div className="space-y-4">
            {pinnedComments.length > 0 && (
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Discussion
              </h4>
            )}
            <div className="space-y-6">
              {topLevelComments.map((c) => renderComment(c))}
            </div>
          </div>
        ) : (
          pinnedComments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
              <MessageSquare className="h-10 w-10 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">
                No comments yet
              </h3>
              <p className="text-slate-500 text-sm">
                Start a discussion about this project.
              </p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
