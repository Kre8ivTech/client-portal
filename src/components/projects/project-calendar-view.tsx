'use client'

import { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Circle,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

type ProjectTask = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  start_date: string | null
  assigned_to: string | null
  assignee?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectCalendarViewProps {
  projectId: string
  tasks: ProjectTask[]
}

function getStatusDot(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-slate-400'
    case 'in_progress':
      return 'bg-blue-500'
    case 'in_review':
      return 'bg-amber-500'
    case 'done':
      return 'bg-green-500'
    case 'cancelled':
      return 'bg-red-400'
    default:
      return 'bg-slate-400'
  }
}

function getPriorityRing(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'ring-red-300'
    case 'high':
      return 'ring-orange-300'
    default:
      return ''
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function ProjectCalendarView({
  projectId,
  tasks,
}: ProjectCalendarViewProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  // Build a map of date -> tasks
  const tasksByDate = useMemo(() => {
    const map: Record<string, ProjectTask[]> = {}
    tasks.forEach((task) => {
      if (task.due_date) {
        const key = task.due_date.slice(0, 10) // YYYY-MM-DD
        if (!map[key]) map[key] = []
        map[key].push(task)
      }
    })
    return map
  }, [tasks])

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const startDayOfWeek = firstDay.getDay()

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Fill in days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth, -i)
      days.push({ date, isCurrentMonth: false })
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({
        date: new Date(currentYear, currentMonth, d),
        isCurrentMonth: true,
      })
    }

    // Fill remaining cells to complete 6 weeks
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(currentYear, currentMonth + 1, i)
      days.push({ date, isCurrentMonth: false })
    }

    return days
  }, [currentMonth, currentYear])

  function goToPreviousMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  function goToToday() {
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
  }

  function formatDateKey(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function isToday(date: Date): boolean {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const tasksWithDates = tasks.filter((t) => t.due_date)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Calendar</CardTitle>
            <CardDescription>
              {tasksWithDates.length} tasks with due dates
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[140px]"
              onClick={goToToday}
            >
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tasksWithDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <CalendarIcon className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No scheduled tasks
            </h3>
            <p className="text-slate-500 text-sm">
              Add due dates to tasks to see them on the calendar.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-center text-xs font-medium text-slate-500"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map(({ date, isCurrentMonth }, index) => {
                const dateKey = formatDateKey(date)
                const dayTasks = tasksByDate[dateKey] ?? []
                const todayClass = isToday(date)

                return (
                  <div
                    key={index}
                    className={`min-h-[80px] md:min-h-[100px] border-b border-r p-1 ${
                      !isCurrentMonth ? 'bg-slate-50/50' : ''
                    } ${index % 7 === 6 ? 'border-r-0' : ''}`}
                  >
                    <div
                      className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        todayClass
                          ? 'bg-primary text-white'
                          : isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded truncate ${
                            task.status === 'done'
                              ? 'bg-green-100 text-green-700 line-through'
                              : task.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700'
                                : task.status === 'in_review'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                          }`}
                          title={task.title}
                        >
                          {task.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[10px] text-slate-400 px-1">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
