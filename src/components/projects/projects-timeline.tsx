'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  FolderKanban,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Project = {
  id: string
  project_number: string
  name: string
  description: string | null
  status: string
  priority: string
  start_date: string | null
  target_end_date: string | null
  actual_end_date: string | null
  organization_id: string
  organizations: {
    id: string
    name: string
  }
}

interface ProjectsTimelineProps {
  projects: Project[]
  userRole: string
}

function getProjectColor(index: number): string {
  const colors = [
    { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
    {
      bg: 'bg-green-100',
      border: 'border-green-300',
      text: 'text-green-700',
    },
    {
      bg: 'bg-purple-100',
      border: 'border-purple-300',
      text: 'text-purple-700',
    },
    { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700' },
    {
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      text: 'text-amber-700',
    },
    { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-700' },
    { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700' },
    {
      bg: 'bg-indigo-100',
      border: 'border-indigo-300',
      text: 'text-indigo-700',
    },
  ]
  return colors[index % colors.length].bg
}

function getProjectBorderColor(index: number): string {
  const colors = [
    { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
    {
      bg: 'bg-green-100',
      border: 'border-green-300',
      text: 'text-green-700',
    },
    {
      bg: 'bg-purple-100',
      border: 'border-purple-300',
      text: 'text-purple-700',
    },
    { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700' },
    {
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      text: 'text-amber-700',
    },
    { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-700' },
    { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700' },
    {
      bg: 'bg-indigo-100',
      border: 'border-indigo-300',
      text: 'text-indigo-700',
    },
  ]
  return colors[index % colors.length].border
}

function getProjectTextColor(index: number): string {
  const colors = [
    { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
    {
      bg: 'bg-green-100',
      border: 'border-green-300',
      text: 'text-green-700',
    },
    {
      bg: 'bg-purple-100',
      border: 'border-purple-300',
      text: 'text-purple-700',
    },
    { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700' },
    {
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      text: 'text-amber-700',
    },
    { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-700' },
    { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700' },
    {
      bg: 'bg-indigo-100',
      border: 'border-indigo-300',
      text: 'text-indigo-700',
    },
  ]
  return colors[index % colors.length].text
}

export function ProjectsTimeline({ projects, userRole }: ProjectsTimelineProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>(
    'month'
  )

  // Get calendar data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const firstDayOfWeek = firstDayOfMonth.getDay()
    const daysInMonth = lastDayOfMonth.getDate()

    // Get days from previous month to fill the first week
    const daysFromPrevMonth = firstDayOfWeek
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    const prevMonthDays = Array.from(
      { length: daysFromPrevMonth },
      (_, i) => ({
        day: prevMonthLastDay - daysFromPrevMonth + i + 1,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - daysFromPrevMonth + i + 1),
      })
    )

    // Get days of current month
    const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      isCurrentMonth: true,
      date: new Date(year, month, i + 1),
    }))

    // Get days from next month to fill the last week
    const totalDays = daysFromPrevMonth + daysInMonth
    const daysToFillLastWeek = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7)
    const nextMonthDays = Array.from({ length: daysToFillLastWeek }, (_, i) => ({
      day: i + 1,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i + 1),
    }))

    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays]
  }, [currentDate])

  // Get projects for a specific date
  const getProjectsForDate = (date: Date) => {
    return projects.filter((project) => {
      if (!project.start_date) return false

      const startDate = new Date(project.start_date)
      const endDate = project.actual_end_date
        ? new Date(project.actual_end_date)
        : project.target_end_date
          ? new Date(project.target_end_date)
          : null

      const dateTime = date.getTime()
      const startTime = startDate.getTime()

      if (endDate) {
        const endTime = endDate.getTime()
        return dateTime >= startTime && dateTime <= endTime
      } else {
        // If no end date, show for 30 days from start
        const defaultEndTime = startTime + 30 * 24 * 60 * 60 * 1000
        return dateTime >= startTime && dateTime <= defaultEndTime
      }
    })
  }

  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    )
  }

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    )
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const monthNames = [
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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleToday}>
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-2xl">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </CardTitle>
            <div className="w-[140px]">
              {/* Placeholder for view mode selector */}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="bg-muted p-3 text-center text-sm font-semibold"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarData.map((dayData, index) => {
              const dayProjects = getProjectsForDate(dayData.date)
              const isToday =
                dayData.date.getTime() === today.getTime() &&
                dayData.isCurrentMonth

              return (
                <div
                  key={index}
                  className={cn(
                    'bg-background min-h-[120px] p-2',
                    !dayData.isCurrentMonth && 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isToday &&
                          'bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center'
                      )}
                    >
                      {dayData.day}
                    </span>
                  </div>

                  {/* Project indicators */}
                  <div className="space-y-1">
                    {dayProjects.slice(0, 3).map((project, projectIndex) => (
                      <Link
                        key={project.id}
                        href={`/dashboard/projects/${project.id}`}
                        className={cn(
                          'block px-2 py-1 rounded text-xs truncate border cursor-pointer transition-all hover:shadow-sm',
                          getProjectColor(projectIndex),
                          getProjectBorderColor(projectIndex),
                          getProjectTextColor(projectIndex)
                        )}
                        title={project.name}
                      >
                        {project.name}
                      </Link>
                    ))}
                    {dayProjects.length > 3 && (
                      <div className="text-xs text-muted-foreground px-2">
                        +{dayProjects.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Project Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects
              .filter((p) => p.status === 'active' && p.start_date)
              .slice(0, 12)
              .map((project, index) => (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-md',
                    getProjectColor(index),
                    getProjectBorderColor(index)
                  )}
                >
                  <FolderKanban
                    className={cn('h-5 w-5', getProjectTextColor(index))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{project.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {project.start_date &&
                        new Date(project.start_date).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      {project.target_end_date &&
                        ` - ${new Date(project.target_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
