'use client'

import { useMemo, useRef, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronLeft,
  ChevronRight,
  GanttChart,
} from 'lucide-react'

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
  progress: number
  assignee?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectGanttChartProps {
  projectId: string
  tasks: ProjectTask[]
  projectStartDate: string | null
  projectEndDate: string | null
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-slate-300'
    case 'in_progress':
      return 'bg-blue-500'
    case 'in_review':
      return 'bg-amber-500'
    case 'done':
      return 'bg-green-500'
    case 'cancelled':
      return 'bg-red-300'
    default:
      return 'bg-slate-300'
  }
}

function getStatusBarBg(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-slate-200'
    case 'in_progress':
      return 'bg-blue-100'
    case 'in_review':
      return 'bg-amber-100'
    case 'done':
      return 'bg-green-100'
    case 'cancelled':
      return 'bg-red-100'
    default:
      return 'bg-slate-200'
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function daysBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ProjectGanttChart({
  projectId,
  tasks,
  projectStartDate,
  projectEndDate,
}: ProjectGanttChartProps) {
  const [weekOffset, setWeekOffset] = useState(0)

  // Filter tasks that have dates
  const tasksWithDates = tasks.filter((t) => t.start_date || t.due_date)

  // Calculate the timeline range
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    if (tasksWithDates.length === 0) {
      const start = projectStartDate
        ? new Date(projectStartDate)
        : new Date()
      const end = projectEndDate
        ? new Date(projectEndDate)
        : addDays(start, 30)
      return {
        timelineStart: start,
        timelineEnd: end,
        totalDays: daysBetween(start, end),
      }
    }

    let earliest = new Date()
    let latest = new Date()

    tasksWithDates.forEach((task) => {
      const start = task.start_date ? new Date(task.start_date) : null
      const end = task.due_date ? new Date(task.due_date) : null

      if (start && start < earliest) earliest = new Date(start)
      if (end && end > latest) latest = new Date(end)
      if (start && !end && start > latest) latest = new Date(start)
    })

    // Add some padding
    earliest = addDays(earliest, -3)
    latest = addDays(latest, 7)

    return {
      timelineStart: earliest,
      timelineEnd: latest,
      totalDays: Math.max(daysBetween(earliest, latest), 14),
    }
  }, [tasksWithDates, projectStartDate, projectEndDate])

  // Generate week columns
  const weeks = useMemo(() => {
    const cols: { start: Date; label: string }[] = []
    const viewStart = addDays(timelineStart, weekOffset * 7)
    const numWeeks = Math.ceil(totalDays / 7) + 1

    for (let i = 0; i < numWeeks; i++) {
      const weekStart = addDays(viewStart, i * 7)
      cols.push({
        start: weekStart,
        label: formatMonthDay(weekStart),
      })
    }
    return cols
  }, [timelineStart, totalDays, weekOffset])

  const viewStart = addDays(timelineStart, weekOffset * 7)
  const viewDays = Math.max(totalDays, 28)
  const dayWidth = 36 // pixels per day
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayOffset = daysBetween(viewStart, today)

  if (tasksWithDates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gantt Chart</CardTitle>
          <CardDescription>
            Visual timeline of project tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <GanttChart className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No scheduled tasks
            </h3>
            <p className="text-slate-500 text-sm">
              Add start and due dates to tasks to see them on the Gantt chart.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gantt Chart</CardTitle>
            <CardDescription>
              Visual timeline of {tasksWithDates.length} scheduled tasks
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((p) => p - 2)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(0)}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((p) => p + 2)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div
            className="min-w-[800px]"
            style={{ width: `${240 + viewDays * dayWidth}px` }}
          >
            {/* Header row with weeks */}
            <div className="flex border-b bg-slate-50">
              <div className="w-[240px] shrink-0 px-4 py-2 text-sm font-medium text-slate-600 border-r">
                Task
              </div>
              <div className="flex-1 flex relative">
                {weeks.map((week, i) => (
                  <div
                    key={i}
                    className="text-xs text-slate-500 border-r border-slate-200 px-1 py-2"
                    style={{ width: `${7 * dayWidth}px` }}
                  >
                    {week.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Task rows */}
            {tasksWithDates.map((task) => {
              const taskStart = task.start_date
                ? new Date(task.start_date)
                : task.due_date
                  ? new Date(task.due_date)
                  : viewStart
              const taskEnd = task.due_date
                ? new Date(task.due_date)
                : task.start_date
                  ? addDays(new Date(task.start_date), 1)
                  : addDays(viewStart, 1)

              const startOffset = daysBetween(viewStart, taskStart)
              const duration = Math.max(daysBetween(taskStart, taskEnd), 1)

              const barLeft = startOffset * dayWidth
              const barWidth = duration * dayWidth

              return (
                <div
                  key={task.id}
                  className="flex border-b hover:bg-slate-50/50 group"
                >
                  <div className="w-[240px] shrink-0 px-4 py-3 border-r flex items-center gap-2 min-h-[44px]">
                    <span className="text-sm truncate flex-1">{task.title}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        task.status === 'done'
                          ? 'bg-green-100 text-green-700'
                          : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex-1 relative py-2">
                    {/* Grid lines */}
                    {weeks.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-r border-slate-100"
                        style={{ left: `${i * 7 * dayWidth}px` }}
                      />
                    ))}
                    {/* Today marker */}
                    {todayOffset >= 0 && todayOffset <= viewDays && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                        style={{ left: `${todayOffset * dayWidth}px` }}
                      />
                    )}
                    {/* Task bar */}
                    {barLeft + barWidth > 0 && barLeft < viewDays * dayWidth && (
                      <div
                        className={`absolute top-2 h-7 rounded-md flex items-center px-2 text-xs font-medium text-white shadow-sm ${getStatusBarBg(task.status)}`}
                        style={{
                          left: `${Math.max(barLeft, 0)}px`,
                          width: `${Math.min(barWidth, viewDays * dayWidth - barLeft)}px`,
                        }}
                      >
                        <div
                          className={`absolute inset-0 rounded-md ${getStatusColor(task.status)}`}
                          style={{
                            width: `${task.status === 'done' ? 100 : task.progress}%`,
                            opacity: 0.9,
                          }}
                        />
                        <span className="relative z-10 truncate text-white drop-shadow-sm">
                          {barWidth > 80 ? task.title : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Today indicator in header */}
            {todayOffset >= 0 && todayOffset <= viewDays && (
              <div
                className="absolute top-0 z-20 flex flex-col items-center pointer-events-none"
                style={{
                  left: `${240 + todayOffset * dayWidth}px`,
                }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 -mt-1" />
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-3 border-t bg-slate-50 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-slate-300" /> To Do
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-blue-500" /> In Progress
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-amber-500" /> In Review
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-green-500" /> Done
          </span>
          <span className="flex items-center gap-1">
            <span className="w-px h-3 bg-red-400" /> Today
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
