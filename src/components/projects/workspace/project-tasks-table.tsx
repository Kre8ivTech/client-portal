'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  XCircle,
  ClipboardPaste,
  WandSparkles,
  ExternalLink,
} from 'lucide-react'
import {
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
} from '@/lib/validators/project'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '@/components/ui/use-toast'
import {
  parseTaskListFromText,
  parsedTaskCandidateSchema,
  type ParsedTaskCandidate,
} from '@/lib/task-list-parser'

type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigned_to: string | null
  created_by: string | null
  due_date: string | null
  start_date: string | null
  completed_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
  assignee?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type Member = {
  user_id: string
  user: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectTasksTableProps {
  projectId: string
  initialTasks: Task[]
  members: Member[]
  canEdit: boolean
}

type SortField = 'title' | 'status' | 'priority' | 'due_date' | 'updated_at'
type SortDirection = 'asc' | 'desc'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

function normalizeParsedTaskCandidates(input: unknown): ParsedTaskCandidate[] {
  if (!Array.isArray(input)) {
    return []
  }

  const normalized: ParsedTaskCandidate[] = []

  for (const item of input) {
    const candidate = parsedTaskCandidateSchema.safeParse(item)
    if (candidate.success) {
      normalized.push(candidate.data)
    }
  }

  return normalized
}

const TASK_INSERT_SELECT_QUERY = `
  id,
  title,
  description,
  status,
  priority,
  start_date,
  due_date,
  completed_at,
  sort_order,
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
  )
`

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

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'in_progress':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'in_review':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'done':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return ''
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

function getPriorityValue(priority: string): number {
  switch (priority) {
    case 'critical':
      return 4
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

export function ProjectTasksTable({
  projectId,
  initialTasks,
  members,
  canEdit,
}: ProjectTasksTableProps) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzingList, setIsAnalyzingList] = useState(false)
  const [isCreatingFromList, setIsCreatingFromList] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
  })
  const [rawTaskList, setRawTaskList] = useState('')
  const [parsedTaskList, setParsedTaskList] = useState<ParsedTaskCandidate[]>([])
  const [taskListSource, setTaskListSource] = useState<'ai' | 'heuristic' | null>(
    null
  )
  const [useAIAnalysis, setUseAIAnalysis] = useState(true)
  const [bulkStatus, setBulkStatus] = useState('todo')
  const [bulkAssignee, setBulkAssignee] = useState('unassigned')
  const router = useRouter()
  const supabase = createClient()

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'priority':
          aValue = getPriorityValue(a.priority)
          bValue = getPriorityValue(b.priority)
          break
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : Infinity
          bValue = b.due_date ? new Date(b.due_date).getTime() : Infinity
          break
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime()
          bValue = new Date(b.updated_at).getTime()
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [tasks, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  const handleToggleTask = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    )
  }

  const handleToggleAll = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([])
    } else {
      setSelectedTasks(tasks.map((t) => t.id))
    }
  }

  function resetTaskListImportState() {
    setRawTaskList('')
    setParsedTaskList([])
    setTaskListSource(null)
    setUseAIAnalysis(true)
    setBulkStatus('todo')
    setBulkAssignee('unassigned')
    setIsAnalyzingList(false)
    setIsCreatingFromList(false)
  }

  async function handleAnalyzeTaskList() {
    const input = rawTaskList.trim()
    if (!input) return

    setIsAnalyzingList(true)
    try {
      const response = await fetch('/api/projects/tasks/parse-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: input,
          use_ai: useAIAnalysis,
          max_items: 100,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to analyze task list'
        )
      }

      const normalized = normalizeParsedTaskCandidates(payload?.tasks)
      if (normalized.length === 0) {
        throw new Error('No tasks were detected in the pasted content')
      }

      setParsedTaskList(normalized)
      setTaskListSource(payload?.source === 'ai' ? 'ai' : 'heuristic')

      if (typeof payload?.warning === 'string' && payload.warning.trim()) {
        toast({
          title: 'List parsed with fallback',
          description: payload.warning,
        })
      } else {
        toast({
          title: 'Task list analyzed',
          description: `Prepared ${normalized.length} task${normalized.length === 1 ? '' : 's'}.`,
        })
      }
    } catch (error) {
      const fallbackTasks = parseTaskListFromText(input, 100)

      if (fallbackTasks.length === 0) {
        toast({
          title: 'Could not parse list',
          description: getErrorMessage(
            error,
            'No actionable tasks were found in the pasted text.'
          ),
          variant: 'destructive',
        })
        return
      }

      setParsedTaskList(fallbackTasks)
      setTaskListSource('heuristic')
      toast({
        title: 'Parsed without AI',
        description:
          'AI analysis was unavailable, so deterministic parsing was used.',
      })
    } finally {
      setIsAnalyzingList(false)
    }
  }

  async function handleCreateTasksFromList() {
    if (parsedTaskList.length === 0) return

    setIsCreatingFromList(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.id) {
        throw new Error('You must be logged in to create tasks')
      }

      const currentMaxOrder = tasks.reduce(
        (max, task) =>
          Number.isFinite(task.sort_order)
            ? Math.max(max, task.sort_order)
            : max,
        0
      )

      const insertPayload = parsedTaskList.map((task, index) => ({
        project_id: projectId,
        title: task.title.trim(),
        description: task.description?.trim() || null,
        status: bulkStatus,
        priority: task.priority,
        assigned_to: bulkAssignee === 'unassigned' ? null : bulkAssignee,
        created_by: user.id,
        sort_order: currentMaxOrder + index + 1,
      }))

      const { data, error } = await supabase
        .from('project_tasks')
        .insert(insertPayload)
        .select(TASK_INSERT_SELECT_QUERY)

      if (error) throw error

      if (data && data.length > 0) {
        setTasks((prev) => [...(data as Task[]), ...prev])
      }

      toast({
        title: 'Tasks created',
        description: `Created ${insertPayload.length} task${insertPayload.length === 1 ? '' : 's'} from your pasted list.`,
      })

      setIsPasteDialogOpen(false)
      resetTaskListImportState()
      router.refresh()
    } catch (error) {
      toast({
        title: 'Failed to create tasks',
        description: getErrorMessage(
          error,
          'An unexpected error occurred while creating tasks.'
        ),
        variant: 'destructive',
      })
    } finally {
      setIsCreatingFromList(false)
    }
  }

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
        .select(TASK_INSERT_SELECT_QUERY)
        .single()

      if (error) throw error

      setTasks((prev) => [data, ...prev])
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
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'done') {
        update.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('project_tasks')
        .update(update)
        .eq('id', taskId)

      if (error) throw error

      setTasks(
        tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: newStatus,
                completed_at:
                  newStatus === 'done' ? new Date().toISOString() : t.completed_at,
                updated_at: new Date().toISOString(),
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

      setTasks(tasks.filter((t) => t.id !== taskId))
      setSelectedTasks(selectedTasks.filter((id) => id !== taskId))
      router.refresh()
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const allSelected = tasks.length > 0 && selectedTasks.length === tasks.length
  const someSelected = selectedTasks.length > 0 && !allSelected

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} in this project
            </CardDescription>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Dialog
                open={isPasteDialogOpen}
                onOpenChange={(open) => {
                  setIsPasteDialogOpen(open)
                  if (!open) {
                    resetTaskListImportState()
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    <ClipboardPaste className="h-4 w-4" />
                    Paste List
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Convert Pasted List to Tasks</DialogTitle>
                    <DialogDescription>
                      Paste a numbered or bulleted list. We&apos;ll split it into
                      individual tasks and optionally refine it with AI.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Pasted list</label>
                      <Textarea
                        value={rawTaskList}
                        onChange={(e) => setRawTaskList(e.target.value)}
                        placeholder="Paste a client list with numbered points or bullets..."
                        className="min-h-[180px]"
                      />
                    </div>

                    <div className="rounded-lg border p-3 space-y-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={useAIAnalysis}
                          onCheckedChange={(checked) =>
                            setUseAIAnalysis(checked === true)
                          }
                        />
                        <span className="flex items-center gap-1.5">
                          <WandSparkles className="h-4 w-4 text-blue-600" />
                          Use AI analysis to improve task formatting
                        </span>
                      </label>

                      <Button
                        variant="secondary"
                        onClick={handleAnalyzeTaskList}
                        disabled={!rawTaskList.trim() || isAnalyzingList}
                      >
                        {isAnalyzingList && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Analyze List
                      </Button>
                    </div>

                    {parsedTaskList.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {parsedTaskList.length} task
                            {parsedTaskList.length === 1 ? '' : 's'} detected
                          </Badge>
                          {taskListSource && (
                            <Badge
                              variant="outline"
                              className={
                                taskListSource === 'ai'
                                  ? 'border-blue-200 text-blue-700 bg-blue-50'
                                  : 'border-slate-200 text-slate-700 bg-slate-50'
                              }
                            >
                              {taskListSource === 'ai'
                                ? 'AI analyzed'
                                : 'Parsed without AI'}
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-sm font-medium">
                              Status for imported tasks
                            </label>
                            <Select value={bulkStatus} onValueChange={setBulkStatus}>
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
                            <label className="text-sm font-medium">
                              Assignee for imported tasks
                            </label>
                            <Select
                              value={bulkAssignee}
                              onValueChange={setBulkAssignee}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">
                                  Unassigned
                                </SelectItem>
                                {members.map((m) => (
                                  <SelectItem key={m.user_id} value={m.user_id}>
                                    {m.user?.profiles?.name ??
                                      m.user?.email ??
                                      'Unknown'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="max-h-[260px] overflow-y-auto rounded-lg border">
                          <div className="divide-y">
                            {parsedTaskList.map((task, index) => (
                              <div key={`${task.title}-${index}`} className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-medium">
                                    {index + 1}. {task.title}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className={getPriorityBadgeClass(task.priority)}
                                  >
                                    {task.priority}
                                  </Badge>
                                </div>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsPasteDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTasksFromList}
                      disabled={parsedTaskList.length === 0 || isCreatingFromList}
                    >
                      {isCreatingFromList && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {parsedTaskList.length > 0
                        ? `Create ${parsedTaskList.length} ${parsedTaskList.length === 1 ? 'Task' : 'Tasks'}`
                        : 'Create Tasks'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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
                              <SelectItem key={m.user_id} value={m.user_id}>
                                {m.user?.profiles?.name ?? m.user?.email ?? 'Unknown'}
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
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <CheckCircle2 className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No tasks yet
            </h3>
            <p className="text-slate-500 text-sm">
              {canEdit
                ? 'Create a task to start tracking work.'
                : 'No tasks have been created yet.'}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    {canEdit && (
                      <Checkbox
                        checked={allSelected}
                        ref={(el) => {
                          if (el) {
                            ;(el as any).indeterminate = someSelected
                          }
                        }}
                        onCheckedChange={handleToggleAll}
                      />
                    )}
                  </TableHead>
                  <TableHead className="w-[30%]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('title')}
                      className="-ml-3"
                    >
                      Task Name
                      {getSortIcon('title')}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[15%]">Assigned To</TableHead>
                  <TableHead className="w-[12%]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('status')}
                      className="-ml-3"
                    >
                      Status
                      {getSortIcon('status')}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[12%]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('due_date')}
                      className="-ml-3"
                    >
                      Due Date
                      {getSortIcon('due_date')}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[10%]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('priority')}
                      className="-ml-3"
                    >
                      Priority
                      {getSortIcon('priority')}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[13%]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('updated_at')}
                      className="-ml-3"
                    >
                      Last Updated
                      {getSortIcon('updated_at')}
                    </Button>
                  </TableHead>
                  {canEdit && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTasks.map((task) => {
                  const isOverdue =
                    task.due_date &&
                    new Date(task.due_date) < new Date() &&
                    task.status !== 'done' &&
                    task.status !== 'cancelled'
                  const assigneeName =
                    task.assignee?.profiles?.name ?? task.assignee?.email
                  const isUpdating = updatingTaskId === task.id

                  return (
                    <TableRow
                      key={task.id}
                      className={isOverdue ? 'bg-red-50/50' : ''}
                    >
                      <TableCell>
                        {canEdit && (
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={() => handleToggleTask(task.id)}
                            disabled={isUpdating}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/projects/${projectId}/tasks/${task.id}`}
                          className="inline-flex items-center gap-1 font-medium hover:text-primary hover:underline"
                        >
                          {task.title}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        {task.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {task.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={task.assignee.profiles?.avatar_url || ''}
                              />
                              <AvatarFallback className="text-xs">
                                {assigneeName?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">
                              {assigneeName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 w-fit ${getStatusBadgeClass(task.status)}`}
                        >
                          {getStatusIcon(task.status)}
                          <span className="capitalize">
                            {task.status.replace('_', ' ')}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span
                              className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}
                            >
                              {new Date(task.due_date).toLocaleDateString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                }
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getPriorityBadgeClass(task.priority)}
                        >
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(task.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
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
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
