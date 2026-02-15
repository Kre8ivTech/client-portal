'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Trash2,
  ListTodo,
  Circle,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  ExternalLink,
} from 'lucide-react'
import {
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
} from '@/lib/validators/project'

type ProjectTask = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigned_to: string | null
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  progress?: number
  sort_order: number
  parent_task_id: string | null
  created_by: string
  created_at: string
  assignee?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type StaffUser = {
  id: string
  email: string
  role: string
  profiles: { name: string | null; avatar_url: string | null } | null
}

interface ProjectTasksListProps {
  projectId: string
  tasks: ProjectTask[]
  members: StaffUser[]
  canEdit: boolean
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'todo':
      return <Circle className="h-4 w-4 text-slate-400" />
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-500" />
    case 'in_review':
      return <Eye className="h-4 w-4 text-amber-500" />
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-red-400" />
    default:
      return <Circle className="h-4 w-4 text-slate-400" />
  }
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

export function ProjectTasksList({
  projectId,
  tasks,
  members,
  canEdit,
}: ProjectTasksListProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
  })
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const filteredTasks =
    filterStatus === 'all'
      ? tasks
      : tasks.filter((t) => t.status === filterStatus)

  const taskStats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    overdue: tasks.filter(
      (t) =>
        t.due_date &&
        new Date(t.due_date) < new Date() &&
        t.status !== 'done' &&
        t.status !== 'cancelled'
    ).length,
  }

  const completionPercent =
    taskStats.total > 0
      ? Math.round((taskStats.done / taskStats.total) * 100)
      : 0

  async function handleCreateTask() {
    if (!newTask.title.trim()) return

    setIsSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from('project_tasks').insert({
        project_id: projectId,
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        status: newTask.status,
        priority: newTask.priority,
        assigned_to: newTask.assigned_to || null,
        due_date: newTask.due_date || null,
        created_by: user?.id,
      })

      if (error) throw error

      setIsCreateDialogOpen(false)
      setNewTask({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        assigned_to: '',
        due_date: '',
      })
      router.refresh()
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateTaskStatus(taskId: string, newStatus: string) {
    setUpdatingTaskId(taskId)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const update: Record<string, unknown> = {
        status: newStatus,
      }
      if (newStatus === 'done') {
        update.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('project_tasks')
        .update(update)
        .eq('id', taskId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Are you sure you want to delete this task?')) return

    setUpdatingTaskId(taskId)
    try {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>
              {taskStats.total} tasks - {completionPercent}% complete
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                {TASK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Task</DialogTitle>
                    <DialogDescription>
                      Add a new task to this project.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        value={newTask.title}
                        onChange={(e) =>
                          setNewTask((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Task title"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={newTask.description}
                        onChange={(e) =>
                          setNewTask((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Optional description"
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Status</label>
                        <Select
                          value={newTask.status}
                          onValueChange={(v) =>
                            setNewTask((prev) => ({ ...prev, status: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Priority</label>
                        <Select
                          value={newTask.priority}
                          onValueChange={(v) =>
                            setNewTask((prev) => ({ ...prev, priority: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_PRIORITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Assign To</label>
                      {members.length > 0 ? (
                        <Select
                          value={newTask.assigned_to}
                          onValueChange={(v) =>
                            setNewTask((prev) => ({ ...prev, assigned_to: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.profiles?.name ?? m.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-slate-500 mt-1">
                          Add members to the project Team tab first.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium">Due Date</label>
                      <Input
                        type="date"
                        value={newTask.due_date}
                        onChange={(e) =>
                          setNewTask((prev) => ({
                            ...prev,
                            due_date: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTask}
                      disabled={!newTask.title.trim() || isSubmitting}
                    >
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Task
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {taskStats.total > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                {taskStats.done} of {taskStats.total} complete
              </span>
              {taskStats.overdue > 0 && (
                <span className="text-red-600 font-medium">
                  {taskStats.overdue} overdue
                </span>
              )}
            </div>
            <Progress value={completionPercent} className="h-2" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <ListTodo className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              {filterStatus === 'all' ? 'No tasks yet' : 'No matching tasks'}
            </h3>
            <p className="text-slate-500 text-sm">
              {canEdit
                ? 'Create a task to start tracking work.'
                : 'No tasks have been created yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const isOverdue =
                task.due_date &&
                new Date(task.due_date) < new Date() &&
                task.status !== 'done' &&
                task.status !== 'cancelled'
              const isUpdating = updatingTaskId === task.id
              const assigneeName =
                task.assignee?.profiles?.name ?? task.assignee?.email

              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    task.status === 'done'
                      ? 'bg-slate-50/50 opacity-75'
                      : isOverdue
                        ? 'bg-red-50/50 border-red-200'
                        : 'hover:bg-slate-50'
                  }`}
                >
                  {canEdit ? (
                    <Checkbox
                      checked={task.status === 'done'}
                      onCheckedChange={(checked) =>
                        handleUpdateTaskStatus(
                          task.id,
                          checked ? 'done' : 'todo'
                        )
                      }
                      disabled={isUpdating}
                    />
                  ) : (
                    getStatusIcon(task.status)
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium truncate ${
                          task.status === 'done'
                            ? 'line-through text-slate-500'
                            : 'text-slate-900'
                        }`}
                      >
                        <Link
                          href={`/dashboard/projects/${projectId}/tasks/${task.id}`}
                          className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                        >
                          {task.title}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${getPriorityBadgeClass(task.priority)}`}
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {task.due_date && (
                        <span
                          className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}
                        >
                          <Calendar className="h-3 w-3" />
                          {new Date(task.due_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                      {assigneeName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {assigneeName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!canEdit && (
                      <Badge variant="outline" className="text-xs">
                        {TASK_STATUS_OPTIONS.find(
                          (s) => s.value === task.status
                        )?.label ?? task.status}
                      </Badge>
                    )}
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {TASK_STATUS_OPTIONS.filter(
                            (s) => s.value !== task.status
                          ).map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() =>
                                handleUpdateTaskStatus(task.id, opt.value)
                              }
                            >
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
