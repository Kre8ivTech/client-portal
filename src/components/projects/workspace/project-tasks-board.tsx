'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { Label } from '@/components/ui/label'
import {
  Plus,
  Loader2,
  MoreHorizontal,
  GripVertical,
  CalendarDays,
  Clock,
  List,
  LayoutGrid,
  Search,
  Filter,
  Trash2,
  Pencil,
  CheckCircle2,
  Circle,
  Timer,
  Eye,
  XCircle,
} from 'lucide-react'

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
  tags: string[]
  estimated_hours: number | null
  actual_hours: number | null
  parent_task_id: string | null
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

interface ProjectTasksBoardProps {
  projectId: string
  initialTasks: Task[]
  members: Member[]
  canEdit: boolean
}

const STATUSES = [
  { value: 'todo', label: 'To Do', icon: Circle, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'in_progress', label: 'In Progress', icon: Timer, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'in_review', label: 'In Review', icon: Eye, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'done', label: 'Done', icon: CheckCircle2, color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-700 border-red-200' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-600' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-600' },
]

export function ProjectTasksBoard({ projectId, initialTasks, members, canEdit }: ProjectTasksBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')

  // New task form state
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newStatus, setNewStatus] = useState('todo')
  const [newPriority, setNewPriority] = useState('medium')
  const [newAssignee, setNewAssignee] = useState<string>('unassigned')
  const [newDueDate, setNewDueDate] = useState('')
  const [newEstimatedHours, setNewEstimatedHours] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assigned_to_fkey(id, email, profiles:profiles(name, avatar_url))
      `)
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (data) setTasks(data as Task[])
  }, [supabase, projectId])

  useEffect(() => {
    const channel = supabase
      .channel(`project-tasks-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks', filter: `project_id=eq.${projectId}` }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, projectId, fetchTasks])

  const filteredTasks = tasks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false
    if (filterAssignee !== 'all' && (t.assigned_to ?? 'unassigned') !== filterAssignee) return false
    return true
  })

  const tasksByStatus = STATUSES.map(s => ({
    ...s,
    tasks: filteredTasks.filter(t => t.status === s.value),
  }))

  function resetForm() {
    setNewTitle('')
    setNewDescription('')
    setNewStatus('todo')
    setNewPriority('medium')
    setNewAssignee('unassigned')
    setNewDueDate('')
    setNewEstimatedHours('')
  }

  async function handleCreateTask() {
    if (!newTitle.trim()) return
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const maxOrder = tasks.reduce((max, t) => Math.max(max, t.sort_order), 0)

      const { error } = await supabase.from('project_tasks').insert({
        project_id: projectId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        status: newStatus,
        priority: newPriority,
        assigned_to: newAssignee !== 'unassigned' ? newAssignee : null,
        created_by: user?.id,
        due_date: newDueDate || null,
        estimated_hours: newEstimatedHours ? parseFloat(newEstimatedHours) : null,
        sort_order: maxOrder + 1,
      })

      if (error) throw error

      await supabase.from('project_activity').insert({
        project_id: projectId,
        user_id: user?.id,
        action: 'created',
        entity_type: 'task',
        details: { title: newTitle.trim() },
      })

      resetForm()
      setIsCreateOpen(false)
      fetchTasks()
      router.refresh()
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateTask() {
    if (!editingTask) return
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('project_tasks').update({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        status: newStatus,
        priority: newPriority,
        assigned_to: newAssignee !== 'unassigned' ? newAssignee : null,
        due_date: newDueDate || null,
        estimated_hours: newEstimatedHours ? parseFloat(newEstimatedHours) : null,
        completed_at: newStatus === 'done' && editingTask.status !== 'done' ? new Date().toISOString() : editingTask.completed_at,
        updated_at: new Date().toISOString(),
      }).eq('id', editingTask.id)

      if (error) throw error

      await supabase.from('project_activity').insert({
        project_id: projectId,
        user_id: user?.id,
        action: 'updated',
        entity_type: 'task',
        entity_id: editingTask.id,
        details: { title: newTitle.trim() },
      })

      resetForm()
      setIsEditOpen(false)
      setEditingTask(null)
      fetchTasks()
      router.refresh()
    } catch (err) {
      console.error('Failed to update task:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusChange(taskId: string, newStatusVal: string) {
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('project_tasks').update({
      status: newStatusVal,
      completed_at: newStatusVal === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId)

    await supabase.from('project_activity').insert({
      project_id: projectId,
      user_id: user?.id,
      action: 'status_changed',
      entity_type: 'task',
      entity_id: taskId,
      details: { new_status: newStatusVal },
    })

    fetchTasks()
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Delete this task? This cannot be undone.')) return

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('project_tasks').delete().eq('id', taskId)
    await supabase.from('project_activity').insert({
      project_id: projectId,
      user_id: user?.id,
      action: 'deleted',
      entity_type: 'task',
      entity_id: taskId,
    })

    fetchTasks()
    router.refresh()
  }

  function openEditDialog(task: Task) {
    setEditingTask(task)
    setNewTitle(task.title)
    setNewDescription(task.description ?? '')
    setNewStatus(task.status)
    setNewPriority(task.priority)
    setNewAssignee(task.assigned_to ?? 'unassigned')
    setNewDueDate(task.due_date ?? '')
    setNewEstimatedHours(task.estimated_hours?.toString() ?? '')
    setIsEditOpen(true)
  }

  function getAssigneeName(task: Task) {
    return task.assignee?.profiles?.name ?? task.assignee?.email ?? null
  }

  const taskFormContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Task title..."
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={newDescription}
          onChange={e => setNewDescription(e.target.value)}
          placeholder="Describe the task..."
          className="min-h-[80px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={newPriority} onValueChange={setNewPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Assignee</Label>
          <Select value={newAssignee} onValueChange={setNewAssignee}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map(m => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.user?.profiles?.name ?? m.user?.email ?? 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input
            type="date"
            value={newDueDate}
            onChange={e => setNewDueDate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Estimated Hours</Label>
        <Input
          type="number"
          step="0.5"
          value={newEstimatedHours}
          onChange={e => setNewEstimatedHours(e.target.value)}
          placeholder="e.g., 4"
        />
      </div>
    </div>
  )

  const taskCard = (task: Task) => {
    const priorityConfig = PRIORITIES.find(p => p.value === task.priority)
    const assigneeName = getAssigneeName(task)
    const initials = assigneeName ? assigneeName.slice(0, 2).toUpperCase() : null
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

    return (
      <div key={task.id} className="group rounded-lg border bg-card p-3 space-y-2.5 hover:shadow-sm transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-tight flex-1">{task.title}</h4>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(task)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {STATUSES.filter(s => s.value !== task.status).map(s => (
                  <DropdownMenuItem key={s.value} onClick={() => handleStatusChange(task.id, s.value)}>
                    <s.icon className="h-3.5 w-3.5 mr-2" /> Move to {s.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-600">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityConfig?.color}`}>
              {task.priority}
            </Badge>
            {task.due_date && (
              <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                <CalendarDays className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {task.estimated_hours && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.estimated_hours}h
              </span>
            )}
          </div>
          {assigneeName && (
            <Avatar className="h-5 w-5">
              <AvatarImage src={task.assignee?.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border p-0.5">
            <Button
              variant={viewMode === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          {canEdit && (
            <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm() }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                  <DialogDescription>Add a new task to this project.</DialogDescription>
                </DialogHeader>
                {taskFormContent}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateTask} disabled={!newTitle.trim() || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Task
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Board View */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tasksByStatus.filter(s => s.value !== 'cancelled').map(column => (
            <div key={column.value} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <column.icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{column.label}</h3>
                  <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">
                    {column.tasks.length}
                  </span>
                </div>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {column.tasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-xs text-muted-foreground">No tasks</p>
                  </div>
                ) : (
                  column.tasks.map(task => taskCard(task))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <h3 className="text-base font-medium mb-1">No tasks found</h3>
                <p className="text-sm text-muted-foreground">
                  {canEdit ? 'Create your first task to get started.' : 'No tasks match your filters.'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredTasks.map(task => {
                  const statusConfig = STATUSES.find(s => s.value === task.status)
                  const priorityConfig = PRIORITIES.find(p => p.value === task.priority)
                  const assigneeName = getAssigneeName(task)
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                  const StatusIcon = statusConfig?.icon ?? Circle

                  return (
                    <div key={task.id} className="group flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                      {canEdit && (
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => handleStatusChange(task.id, task.status === 'done' ? 'todo' : 'done')}
                        >
                          <StatusIcon className="h-4 w-4" />
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityConfig?.color}`}>
                          {task.priority}
                        </Badge>
                        {task.due_date && (
                          <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                            <CalendarDays className="h-3 w-3" />
                            {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {assigneeName && (
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px]">
                              {assigneeName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-600">
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
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
      )}

      {/* Edit Task Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditingTask(null); resetForm() } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details.</DialogDescription>
          </DialogHeader>
          {taskFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateTask} disabled={!newTitle.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
