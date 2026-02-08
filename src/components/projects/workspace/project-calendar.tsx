'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Circle, Timer, Eye, CheckCircle2, XCircle } from 'lucide-react'

type Task = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  start_date: string | null
  estimated_hours: number | null
  assigned_to: string | null
  assignee?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectCalendarProps {
  tasks: Task[]
  projectStartDate: string | null
  projectEndDate: string | null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
  medium: 'bg-blue-200 text-blue-700 hover:bg-blue-300',
  high: 'bg-orange-200 text-orange-700 hover:bg-orange-300',
  critical: 'bg-red-200 text-red-700 hover:bg-red-300',
}

const STATUS_CONFIG: Record<string, { icon: any; label: string }> = {
  todo: { icon: Circle, label: 'To Do' },
  in_progress: { icon: Timer, label: 'In Progress' },
  in_review: { icon: Eye, label: 'In Review' },
  done: { icon: CheckCircle2, label: 'Done' },
  cancelled: { icon: XCircle, label: 'Cancelled' },
}

export function ProjectCalendar({ tasks, projectStartDate, projectEndDate }: ProjectCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<{ date: Date; tasks: Task[] } | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days: { date: Date; isCurrentMonth: boolean; tasks: Task[]; isToday: boolean; isProjectRange: boolean }[] = []

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i)
      days.push({ date, isCurrentMonth: false, tasks: [], isToday: false, isProjectRange: false })
    }

    // Current month days
    const today = new Date()
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d)
      const dateStr = date.toISOString().split('T')[0]
      const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()

      const dayTasks = tasks.filter(t => {
        if (t.due_date === dateStr) return true
        if (t.start_date === dateStr) return true
        return false
      })

      let isProjectRange = false
      if (projectStartDate && projectEndDate) {
        const start = new Date(projectStartDate)
        const end = new Date(projectEndDate)
        isProjectRange = date >= start && date <= end
      }

      days.push({ date, isCurrentMonth: true, tasks: dayTasks, isToday, isProjectRange })
    }

    // Next month padding
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i)
      days.push({ date, isCurrentMonth: false, tasks: [], isToday: false, isProjectRange: false })
    }

    return days
  }, [year, month, tasks, projectStartDate, projectEndDate])

  const taskStats = useMemo(() => {
    const total = tasks.length
    const withDueDate = tasks.filter(t => t.due_date).length
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length
    const dueThisMonth = tasks.filter(t => {
      if (!t.due_date) return false
      const d = new Date(t.due_date)
      return d.getMonth() === month && d.getFullYear() === year
    }).length
    return { total, withDueDate, overdue, dueThisMonth }
  }, [tasks, month, year])

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span><span className="font-medium text-foreground">{taskStats.dueThisMonth}</span> due this month</span>
        </div>
        {taskStats.overdue > 0 && (
          <div className="flex items-center gap-1.5 text-red-600">
            <Clock className="h-4 w-4" />
            <span><span className="font-medium">{taskStats.overdue}</span> overdue</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span><span className="font-medium text-foreground">{taskStats.withDueDate}</span> of {taskStats.total} tasks scheduled</span>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/50">
          {DAYS.map(day => (
            <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground border-b">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const hasTasks = day.tasks.length > 0

            return (
              <button
                key={idx}
                className={`
                  min-h-[80px] md:min-h-[100px] p-1.5 border-b border-r text-left transition-colors relative
                  ${!day.isCurrentMonth ? 'bg-muted/30 text-muted-foreground/50' : 'hover:bg-muted/50'}
                  ${day.isToday ? 'bg-primary/5' : ''}
                  ${day.isProjectRange && day.isCurrentMonth ? 'bg-primary/5' : ''}
                  ${hasTasks ? 'cursor-pointer' : 'cursor-default'}
                `}
                onClick={() => hasTasks ? setSelectedDay({ date: day.date, tasks: day.tasks }) : null}
              >
                <span className={`
                  text-xs font-medium inline-flex items-center justify-center h-6 w-6 rounded-full
                  ${day.isToday ? 'bg-primary text-primary-foreground' : ''}
                `}>
                  {day.date.getDate()}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {day.tasks.slice(0, 3).map(task => (
                    <div
                      key={task.id}
                      className={`text-[10px] px-1 py-0.5 rounded truncate font-medium ${PRIORITY_COLORS[task.priority] ?? 'bg-muted'}`}
                    >
                      {task.title}
                    </div>
                  ))}
                  {day.tasks.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{day.tasks.length - 3} more</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && selectedDay.date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {selectedDay?.tasks.map(task => {
              const StatusIcon = STATUS_CONFIG[task.status]?.icon ?? Circle
              const assigneeName = task.assignee?.profiles?.name ?? task.assignee?.email ?? null

              return (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <StatusIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[task.priority]?.replace('hover:bg-', '') ?? ''}`}>
                        {task.priority}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {STATUS_CONFIG[task.status]?.label ?? task.status}
                      </Badge>
                      {task.estimated_hours && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {task.estimated_hours}h
                        </span>
                      )}
                    </div>
                    {assigneeName && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={task.assignee?.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px]">{assigneeName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{assigneeName}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
