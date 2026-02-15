'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { TaskComments } from '@/components/tasks/task-comments'
import { TaskFiles } from '@/components/tasks/task-files'
import { TaskFeedback } from '@/components/tasks/task-feedback'
import { TaskScreenshotCanvas } from '@/components/tasks/task-screenshot-canvas'
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '@/lib/validators/project'
import {
  CalendarDays,
  FileText,
  Loader2,
  MessageSquare,
  MessageSquareText,
  Paperclip,
  ShieldAlert,
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

type TaskFile = {
  id: string
  task_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  description: string | null
  created_at: string
  updated_at: string
  uploaded_by: {
    id: string
    name: string | null
    avatar_url: string | null
  }
}

type TaskDetails = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  progress: number | null
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  created_by: string
  assigned_to: string | null
  assignee?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
  creator?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectTaskWorkspaceProps {
  task: TaskDetails
  comments: TaskComment[]
  files: TaskFile[]
  currentUserId: string
  canEdit: boolean
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'low':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return ''
  }
}

export function ProjectTaskWorkspace({
  task,
  comments,
  files,
  currentUserId,
  canEdit,
}: ProjectTaskWorkspaceProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [isSaving, setIsSaving] = useState(false)
  const [statusValue, setStatusValue] = useState(task.status)
  const [priorityValue, setPriorityValue] = useState(task.priority)

  const assigneeName = task.assignee?.profiles?.name ?? task.assignee?.email ?? 'Unassigned'
  const creatorName = task.creator?.profiles?.name ?? task.creator?.email ?? 'Unknown'
  const feedbackCount = comments.filter(
    (comment) =>
      !comment.parent_comment_id &&
      !comment.is_internal &&
      comment.content.trim().toLowerCase().startsWith('[feedback]')
  ).length

  async function updateTaskMeta(next: { status?: string; priority?: string }) {
    if (!canEdit) return

    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...next,
        updated_at: new Date().toISOString(),
      }
      if (next.status === 'done') {
        payload.completed_at = new Date().toISOString()
      }
      if (next.status && next.status !== 'done') {
        payload.completed_at = null
      }

      const { error } = await supabase
        .from('project_tasks')
        .update(payload)
        .eq('id', task.id)

      if (error) throw error

      toast({
        title: 'Task updated',
        description: 'Task details were updated successfully.',
      })
      router.refresh()
    } catch {
      toast({
        title: 'Update failed',
        description: 'Could not update the task. Please try again.',
        variant: 'destructive',
      })
      setStatusValue(task.status)
      setPriorityValue(task.priority)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={getPriorityBadgeClass(priorityValue)}>
              {priorityValue}
            </Badge>
            <Badge variant="secondary">{statusValue.replace('_', ' ')}</Badge>
            {task.completed_at && <Badge variant="outline">Completed</Badge>}
            {isSaving && (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl">{task.title}</CardTitle>
          <CardDescription className="text-sm">
            {task.description || 'No description has been added for this task yet.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Due date</p>
              <p className="mt-1 text-sm font-medium flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDate(task.due_date)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Assignee</p>
              <p className="mt-1 text-sm font-medium">{assigneeName}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Created by</p>
              <p className="mt-1 text-sm font-medium">{creatorName}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="mt-1 text-sm font-medium">{formatDate(task.updated_at)}</p>
            </div>
          </div>

          {canEdit ? (
            <>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select
                    value={statusValue}
                    onValueChange={(value) => {
                      setStatusValue(value)
                      void updateTaskMeta({ status: value })
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Select
                    value={priorityValue}
                    onValueChange={(value) => {
                      setPriorityValue(value)
                      void updateTaskMeta({ priority: value })
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              You can view this task but cannot modify status or priority.
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="comments" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-lg bg-transparent p-0 sm:grid-cols-4">
          <TabsTrigger value="comments" className="gap-1.5 rounded-lg border data-[state=active]:bg-muted">
            <MessageSquare className="h-4 w-4" />
            Comments ({comments.length})
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5 rounded-lg border data-[state=active]:bg-muted">
            <MessageSquareText className="h-4 w-4" />
            Feedback ({feedbackCount})
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5 rounded-lg border data-[state=active]:bg-muted">
            <Paperclip className="h-4 w-4" />
            Files ({files.length})
          </TabsTrigger>
          <TabsTrigger value="canvas" className="gap-1.5 rounded-lg border data-[state=active]:bg-muted">
            <FileText className="h-4 w-4" />
            Screenshot Canvas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="mt-5">
          <TaskComments
            taskId={task.id}
            comments={comments}
            currentUserId={currentUserId}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="feedback" className="mt-5">
          <TaskFeedback taskId={task.id} comments={comments} currentUserId={currentUserId} />
        </TabsContent>
        <TabsContent value="files" className="mt-5">
          <TaskFiles
            taskId={task.id}
            files={files}
            currentUserId={currentUserId}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="canvas" className="mt-5">
          <TaskScreenshotCanvas taskId={task.id} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
