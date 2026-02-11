'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  Send,
  MessageSquare,
  CheckCircle2,
  Upload,
  Trash2,
  Pencil,
  UserPlus,
  FolderKanban,
  Activity,
  Clock,
} from 'lucide-react'

type ActivityItem = {
  id: string
  project_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, any>
  created_at: string
  user?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type Comment = {
  id: string
  project_id: string
  task_id: string | null
  author_id: string
  content: string
  is_edited: boolean
  created_at: string
  updated_at: string
  author?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectActivityFeedProps {
  projectId: string
  initialActivity: ActivityItem[]
  initialComments: Comment[]
  currentUserId: string
  canEdit: boolean
}

function getActionIcon(action: string) {
  switch (action) {
    case 'created': return FolderKanban
    case 'updated': return Pencil
    case 'deleted': return Trash2
    case 'status_changed': return CheckCircle2
    case 'uploaded': return Upload
    case 'assigned': return UserPlus
    default: return Activity
  }
}

function getActionDescription(activity: ActivityItem) {
  const { action, entity_type, details } = activity
  switch (action) {
    case 'created':
      return `created ${entity_type} "${details?.title ?? ''}"`
    case 'updated':
      return `updated ${entity_type} "${details?.title ?? ''}"`
    case 'deleted':
      return `deleted a ${entity_type}`
    case 'status_changed':
      return `changed ${entity_type} status to ${details?.new_status?.replace('_', ' ') ?? ''}`
    case 'uploaded':
      return `uploaded file "${details?.name ?? ''}"`
    case 'assigned':
      return `assigned a member to the project`
    case 'commented':
      return `left a comment`
    default:
      return `performed ${action} on ${entity_type}`
  }
}

function timeAgo(dateString: string, referenceNow?: Date | null) {
  const date = new Date(dateString)
  if (!referenceNow) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const diffMs = referenceNow.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ProjectActivityFeed({
  projectId,
  initialActivity,
  initialComments,
  currentUserId,
  canEdit,
}: ProjectActivityFeedProps) {
  const [activity, setActivity] = useState<ActivityItem[]>(initialActivity)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'comments'>('all')
  const [now, setNow] = useState<Date | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setNow(new Date())
  }, [])

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from('project_activity')
      .select(`
        *,
        user:users!project_activity_user_id_fkey(id, email, profiles:profiles!user_id(name, avatar_url))
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setActivity(data as ActivityItem[])
  }, [supabase, projectId])

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('project_comments')
      .select(`
        *,
        author:users!project_comments_author_id_fkey(id, email, profiles:profiles!user_id(name, avatar_url))
      `)
      .eq('project_id', projectId)
      .is('task_id', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setComments(data as Comment[])
  }, [supabase, projectId])

  useEffect(() => {
    const activityChannel = supabase
      .channel(`project-activity-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_activity', filter: `project_id=eq.${projectId}` }, () => {
        fetchActivity()
      })
      .subscribe()

    const commentsChannel = supabase
      .channel(`project-comments-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_comments', filter: `project_id=eq.${projectId}` }, () => {
        fetchComments()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(activityChannel)
      supabase.removeChannel(commentsChannel)
    }
  }, [supabase, projectId, fetchActivity, fetchComments])

  async function handlePostComment() {
    if (!newComment.trim()) return
    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('project_comments').insert({
        project_id: projectId,
        author_id: currentUserId,
        content: newComment.trim(),
      })

      if (error) throw error

      await supabase.from('project_activity').insert({
        project_id: projectId,
        user_id: currentUserId,
        action: 'commented',
        entity_type: 'comment',
        details: { preview: newComment.trim().slice(0, 100) },
      })

      setNewComment('')
      fetchComments()
      fetchActivity()
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return

    await supabase.from('project_comments').delete().eq('id', commentId)
    fetchComments()
  }

  // Merge activity and comments into a single timeline for the "all" view
  const allItems = activeTab === 'all'
    ? [
        ...activity.map(a => ({ type: 'activity' as const, data: a, date: a.created_at })),
        ...comments.map(c => ({ type: 'comment' as const, data: c, date: c.created_at })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50)
    : comments.map(c => ({ type: 'comment' as const, data: c, date: c.created_at }))

  return (
    <div className="space-y-4">
      {/* Comment Box */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Write a comment or update..."
              className="min-h-[80px] resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handlePostComment()
                }
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Press Ctrl+Enter to send
              </p>
              <Button size="sm" onClick={handlePostComment} disabled={!newComment.trim() || isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
                Comment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('all')}
        >
          <Activity className="h-3.5 w-3.5 inline mr-1.5" />
          All Activity
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'comments' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('comments')}
        >
          <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />
          Comments ({comments.length})
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-medium mb-1">No activity yet</h3>
            <p className="text-sm text-muted-foreground">Activity and comments will appear here.</p>
          </div>
        ) : (
          allItems.map(item => {
            if (item.type === 'comment') {
              const comment = item.data as Comment
              const authorName = comment.author?.profiles?.name ?? comment.author?.email ?? 'Unknown'
              const initials = authorName.slice(0, 2).toUpperCase()
              const isOwn = comment.author_id === currentUserId

              return (
                <div key={`comment-${comment.id}`} className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={comment.author?.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{authorName}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(comment.created_at, now)}
                      </span>
                      {comment.is_edited && (
                        <span className="text-xs text-muted-foreground">(edited)</span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    {isOwn && (
                      <button
                        className="text-xs text-muted-foreground hover:text-red-500 mt-1 transition-colors"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            } else {
              const act = item.data as ActivityItem
              const userName = act.user?.profiles?.name ?? act.user?.email ?? 'System'
              const ActionIcon = getActionIcon(act.action)

              return (
                <div key={`activity-${act.id}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <ActionIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="flex-1 min-w-0">
                    <span className="font-medium">{userName}</span>{' '}
                    <span className="text-muted-foreground">{getActionDescription(act)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(act.created_at, now)}</span>
                </div>
              )
            }
          })
        )}
      </div>
    </div>
  )
}
