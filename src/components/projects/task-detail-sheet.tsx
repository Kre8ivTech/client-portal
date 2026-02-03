'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  Clock,
  Loader2,
  MessageSquare,
  Trash2,
  User,
  Flag,
  CheckCircle2,
  Play,
  Pause,
  Send,
} from 'lucide-react'
import {
  updateTaskSchema,
  UpdateTaskInput,
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_TYPE_OPTIONS,
} from '@/lib/validators/project'
import { cn } from '@/lib/utils'
import { Task } from './task-card'

type ProjectMember = {
  id: string
  user_id: string
  role: string
  user: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type Milestone = {
  id: string
  name: string
}

type TaskComment = {
  id: string
  content: string
  created_at: string
  author: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  }
}

type TimeEntry = {
  id: string
  hours: number
  entry_date: string
  description: string | null
  billable: boolean
  user: {
    id: string
    email: string
    profiles: { name: string | null } | null
  }
}

interface TaskDetailSheetProps {
  task: Task | null
  projectId: string
  members: ProjectMember[]
  milestones: Milestone[]
  canEdit: boolean
  isOpen: boolean
  onClose: () => void
  onTaskUpdated: () => void
}

export function TaskDetailSheet({
  task,
  projectId,
  members,
  milestones,
  canEdit,
  isOpen,
  onClose,
  onTaskUpdated,
}: TaskDetailSheetProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [newComment, setNewComment] = useState('')
  const [isAddingComment, setIsAddingComment] = useState(false)
  const router = useRouter()

  const form = useForm<UpdateTaskInput>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'backlog',
      priority: 'medium',
      task_type: 'task',
    },
  })

  // Load full task details when opened
  useEffect(() => {
    if (task && isOpen) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        status: task.status as UpdateTaskInput['status'],
        priority: task.priority as UpdateTaskInput['priority'],
        task_type: task.task_type as UpdateTaskInput['task_type'],
        assignee_id: task.assignee?.id ?? null,
        milestone_id: task.milestone?.id ?? null,
        due_date: task.due_date ?? null,
        estimated_hours: task.estimated_hours ?? null,
      })
      fetchTaskDetails()
    }
  }, [task, isOpen])

  async function fetchTaskDetails() {
    if (!task) return
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${task.id}`)
      if (!response.ok) throw new Error('Failed to fetch task details')
      const { data } = await response.json()
      setComments(data.comments ?? [])
      setTimeEntries(data.time_entries ?? [])
    } catch (error) {
      console.error('Failed to fetch task details:', error)
    }
  }

  async function onSubmit(data: UpdateTaskInput) {
    if (!task) return
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to update task')

      onTaskUpdated()
      router.refresh()
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDelete() {
    if (!task) return
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete task')

      onClose()
      onTaskUpdated()
      router.refresh()
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleAddComment() {
    if (!task || !newComment.trim()) return
    setIsAddingComment(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      })

      if (!response.ok) throw new Error('Failed to add comment')

      setNewComment('')
      fetchTaskDetails()
    } catch (error) {
      console.error('Failed to add comment:', error)
    } finally {
      setIsAddingComment(false)
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'in_progress':
        return <Play className="h-4 w-4 text-blue-500" />
      case 'blocked':
        return <Pause className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  if (!task) return null

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <span className="font-mono">#{task.task_number}</span>
                {getStatusIcon(task.status)}
              </div>
              <SheetTitle className="text-xl">{task.title}</SheetTitle>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-slate-400 hover:text-red-500"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="comments" className="flex-1">
                  Comments ({comments.length})
                </TabsTrigger>
                <TabsTrigger value="time" className="flex-1">
                  Time ({timeEntries.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {canEdit ? (
                      <>
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  className="min-h-[100px]"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {TASK_STATUS_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {TASK_PRIORITY_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="assignee_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Assignee</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value ?? undefined}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Unassigned" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {members
                                      .filter((m) => m.user)
                                      .map((member) => (
                                        <SelectItem key={member.user_id} value={member.user_id}>
                                          {member.user?.profiles?.name ?? member.user?.email}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="due_date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Due Date</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button type="submit" disabled={isUpdating} className="w-full">
                          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Changes
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-1">Description</h4>
                          <p className="text-slate-700 whitespace-pre-wrap">
                            {task.description || 'No description'}
                          </p>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-slate-500 mb-1">Status</h4>
                            <Badge>{task.status}</Badge>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-slate-500 mb-1">Priority</h4>
                            <Badge variant="outline">{task.priority}</Badge>
                          </div>
                        </div>
                        {task.assignee && (
                          <div>
                            <h4 className="text-sm font-medium text-slate-500 mb-1">Assignee</h4>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={task.assignee.profiles?.avatar_url ?? undefined} />
                                <AvatarFallback>
                                  {(task.assignee.profiles?.name ?? task.assignee.email).slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>{task.assignee.profiles?.name ?? task.assignee.email}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="comments" className="mt-4">
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">No comments yet</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.author.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {(comment.author.profiles?.name ?? comment.author.email).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {comment.author.profiles?.name ?? comment.author.email}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mt-1">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  )}

                  {canEdit && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Input
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                      />
                      <Button
                        size="icon"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || isAddingComment}
                      >
                        {isAddingComment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="time" className="mt-4">
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Estimated</p>
                      <p className="text-lg font-semibold">{task.estimated_hours ?? 0}h</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Logged</p>
                      <p className="text-lg font-semibold">{task.actual_hours ?? 0}h</p>
                    </div>
                  </div>

                  {/* Time entries */}
                  {timeEntries.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">No time logged</p>
                  ) : (
                    <div className="space-y-2">
                      {timeEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">
                              {entry.user.profiles?.name ?? entry.user.email}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(entry.entry_date).toLocaleDateString()}
                              {entry.description && ` - ${entry.description}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{entry.hours}h</p>
                            {entry.billable && (
                              <Badge variant="outline" className="text-xs">Billable</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
