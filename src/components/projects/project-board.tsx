'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, LayoutGrid, List, Filter } from 'lucide-react'
import { TaskCard, Task } from './task-card'
import { CreateTaskDialog } from './create-task-dialog'
import { TaskDetailSheet } from './task-detail-sheet'
import { KANBAN_COLUMNS } from '@/lib/validators/project'
import { cn } from '@/lib/utils'

type ProjectMember = {
  id: string
  user_id: string
  role: string
  is_active: boolean
  user: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type Milestone = {
  id: string
  name: string
  due_date: string | null
}

interface ProjectBoardProps {
  projectId: string
  members: ProjectMember[]
  milestones: Milestone[]
  canEdit: boolean
}

export function ProjectBoard({ projectId, members, milestones, canEdit }: ProjectBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const router = useRouter()

  const activeMembers = members.filter((m) => m.is_active)

  useEffect(() => {
    fetchTasks()
  }, [projectId])

  async function fetchTasks() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`)
      if (!response.ok) throw new Error('Failed to fetch tasks')
      const { data } = await response.json()
      setTasks(data ?? [])
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function moveTask(taskId: string, newStatus: string, newOrder: number) {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, board_column_order: newOrder }),
      })

      if (!response.ok) throw new Error('Failed to move task')

      // Optimistically update the UI
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, status: newStatus, board_column_order: newOrder }
            : task
        )
      )
    } catch (error) {
      console.error('Failed to move task:', error)
      // Refetch to sync state
      fetchTasks()
    }
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd() {
    setDraggedTask(null)
    setDragOverColumn(null)
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  function handleDragLeave() {
    setDragOverColumn(null)
  }

  function handleDrop(e: React.DragEvent, columnId: string) {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedTask || draggedTask.status === columnId) {
      setDraggedTask(null)
      return
    }

    // Get the max order in the target column
    const columnTasks = tasks.filter((t) => t.status === columnId)
    const maxOrder = columnTasks.length > 0
      ? Math.max(...columnTasks.map((t) => (t as any).board_column_order ?? 0))
      : -1

    moveTask(draggedTask.id, columnId, maxOrder + 1)
    setDraggedTask(null)
  }

  function handleTaskClick(task: Task) {
    setSelectedTask(task)
    setIsTaskDetailOpen(true)
  }

  function getColumnTasks(columnId: string) {
    return tasks
      .filter((task) => task.status === columnId)
      .sort((a, b) => ((a as any).board_column_order ?? 0) - ((b as any).board_column_order ?? 0))
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-72">
            <div className="bg-slate-100 rounded-lg p-3">
              <Skeleton className="h-6 w-24 mb-3" />
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Board header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Task Board</h3>
          <Badge variant="secondary">{tasks.length} tasks</Badge>
        </div>
        {canEdit && (
          <CreateTaskDialog
            projectId={projectId}
            members={activeMembers}
            milestones={milestones}
            onTaskCreated={fetchTasks}
          />
        )}
      </div>

      {/* Kanban board */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {KANBAN_COLUMNS.map((column) => {
            const columnTasks = getColumnTasks(column.id)
            const isOver = dragOverColumn === column.id

            return (
              <div
                key={column.id}
                className="flex-shrink-0 w-72"
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div
                  className={cn(
                    'rounded-lg p-3 transition-colors',
                    column.color,
                    isOver && 'ring-2 ring-primary ring-offset-2'
                  )}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-700">{column.label}</h4>
                      <Badge variant="outline" className="text-xs">
                        {columnTasks.length}
                      </Badge>
                    </div>
                    {canEdit && (
                      <CreateTaskDialog
                        projectId={projectId}
                        members={activeMembers}
                        milestones={milestones}
                        defaultStatus={column.id}
                        onTaskCreated={fetchTasks}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Plus className="h-4 w-4" />
                          </Button>
                        }
                      />
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="space-y-2 min-h-[100px]">
                    {columnTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                      >
                        <TaskCard
                          task={task}
                          onClick={() => handleTaskClick(task)}
                          isDragging={draggedTask?.id === task.id}
                        />
                      </div>
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Task detail sheet */}
      <TaskDetailSheet
        task={selectedTask}
        projectId={projectId}
        members={activeMembers}
        milestones={milestones}
        canEdit={canEdit}
        isOpen={isTaskDetailOpen}
        onClose={() => {
          setIsTaskDetailOpen(false)
          setSelectedTask(null)
        }}
        onTaskUpdated={fetchTasks}
      />
    </div>
  )
}
