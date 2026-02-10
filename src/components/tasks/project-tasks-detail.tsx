'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
  Filter,
  Search,
  AlertCircle,
} from 'lucide-react'
import {
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
} from '@/lib/validators/project'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type ProjectTask = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  progress?: number | null
  sort_order: number
  parent_task_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  assignee?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
  creator?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  }
}

type StaffUser = {
  id: string
  email: string
  role: string
  profiles: { name: string | null; avatar_url: string | null } | null
  project_role?: string
}

type Project = {
  id: string
  project_number: string
  name: string
  description: string | null
  status: string
  created_by: string
  organization_id: string
  organizations: {
    id: string
    name: string
  }
}

interface ProjectTasksDetailProps {
  projectId: string
  project: Project
  tasks: ProjectTask[]
  members: StaffUser[]
  canEdit: boolean
  userRole: string
  userId: string
  highlightedTaskId?: string
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

export function ProjectTasksDetail({
  projectId,
  project,
  tasks: initialTasks,
  members,
  canEdit,
  userRole,
  userId,
  highlightedTaskId,
}: ProjectTasksDetailProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
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

  // Update tasks when initialTasks changes
  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  // Scroll to highlighted task
  useEffect(() => {
    if (highlightedTaskId) {
      setTimeout(() => {
        const element = document.getElementById(`task-${highlightedTaskId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2')
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2')
          }, 2000)
        }
      }, 100)
    }
  }, [highlightedTaskId])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      )
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((t) => t.status === filterStatus)
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter((t) => t.priority === filterPriority)
    }

    return filtered
  }, [tasks, searchQuery, filterStatus, filterPriority])

  // Calculate stats
  const taskStats = useMemo(() => {
    const now = new Date()
    return {
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'done').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      overdue: tasks.filter(
        (t) =>
          t.due_date &&
          new Date(t.due_date) < now &&
          t.status !== 'done' &&
          t.status !== 'cancelled'
      ).length,
    }
  }, [tasks])

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

      const { data, error } = await supabase
        .from('project_tasks')
        .insert({
          project_id: projectId,
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          status: newTask.status,
          priority: newTask.priority,
          assigned_to: newTask.assigned_to || null,
          due_date: newTask.due_date || null,
          created_by: user?.id,
        })
        .select(
          `
          id,
          title,
          description,
          status,
          priority,
          start_date,
          due_date,
          completed_at,
          progress,
          sort_order,
          parent_task_id,
          created_by,
          created_at,
          updated_at,
          assignee:users!assigned_to (
            id,
            email,
            profiles:profiles!user_id (
              name,
              avatar_url
            )
          ),
          creator:users!created_by (
            id,
            email,
            profiles:profiles!user_id (
              name,
              avatar_url
            )
          )
        `
        )
        .single()

      if (error) throw error

      setTasks([data, ...tasks])
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

      // Optimistically update local state
      setTasks(
        tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: newStatus,
                completed_at: newStatus === 'done' ? new Date().toISOString() : t.completed_at,
              }
            : t
        )
      )
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

      // Remove from local state
      setTasks(tasks.filter((t) => t.id !== taskId))
      router.refresh()
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Tasks</CardDescription>
            <CardTitle className="text-2xl">{taskStats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              {taskStats.inProgress}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              {taskStats.overdue}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {completionPercent}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Overdue Alert */}
      {taskStats.overdue > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Overdue Tasks</AlertTitle>
          <AlertDescription>
            You have {taskStats.overdue} task{taskStats.overdue !== 1 ? 's' : ''} past their due date.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tasks Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                {taskStats.total} tasks - {completionPercent}% complete
              </CardDescription>
            </div>
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
                          Add members to the project first.
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

          {/* Progress Bar */}
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

          {/* Filters */}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {TASK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger>
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {TASK_PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
              <ListTodo className="h-10 w-10 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">
                {filterStatus !== 'all' || filterPriority !== 'all' || searchQuery
                  ? 'No matching tasks'
                  : 'No tasks yet'}
              </h3>
              <p className="text-slate-500 text-sm">
                {canEdit && !searchQuery && filterStatus === 'all' && filterPriority === 'all'
                  ? 'Create a task to start tracking work.'
                  : searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
                    ? 'Try adjusting your filters.'
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
                    id={`task-${task.id}`}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
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
                          {task.title}
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
                              year: 'numeric',
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
    </div>
  )
}
