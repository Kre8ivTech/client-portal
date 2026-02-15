'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  CheckCircle2,
  Circle,
  Timer,
  Eye,
  XCircle,
  CalendarDays,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'

type Task = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  assigned_to: string | null
  assignee?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type Member = {
  user_id: string
  role: string
  user: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type ProjectData = {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  start_date: string | null
  target_end_date: string | null
  actual_end_date: string | null
  budget_amount: number | null
  tags: string[] | null
  created_at: string
  creator?: {
    id: string
    email: string
    profiles: { name: string | null } | null
  } | null
}

interface ProjectOverviewProps {
  project: ProjectData
  tasks: Task[]
  members: Member[]
  fileCount: number
  commentCount: number
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'active': return 'default'
    case 'completed': return 'secondary'
    case 'on_hold':
    case 'cancelled': return 'destructive'
    default: return 'outline'
  }
}

function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'low': return 'bg-slate-100 text-slate-700 border-slate-200'
    default: return ''
  }
}

const STATUS_ICONS: Record<string, any> = {
  todo: Circle,
  in_progress: Timer,
  in_review: Eye,
  done: CheckCircle2,
  cancelled: XCircle,
}

export function ProjectOverview({ project, tasks, members, fileCount, commentCount }: ProjectOverviewProps) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
  }, [])

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length
  const inReviewTasks = tasks.filter(t => t.status === 'in_review').length
  const todoTasks = tasks.filter(t => t.status === 'todo').length
  const overdueTasks = now
    ? tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done' && t.status !== 'cancelled')
    : []
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const upcomingTasks = now
    ? tasks
        .filter(t => t.due_date && new Date(t.due_date) >= now && t.status !== 'done' && t.status !== 'cancelled')
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 5)
    : []

  return (
    <div className="space-y-6">
      {/* Progress and Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Progress</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{progress}%</div>
            <Progress value={progress} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {doneTasks} of {totalTasks} tasks complete
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Tasks</p>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>{todoTasks} todo</span>
              <span>{inProgressTasks} active</span>
              <span>{doneTasks} done</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Files</p>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{fileCount}</div>
            <p className="text-xs text-muted-foreground mt-1.5">Project files uploaded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Comments</p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{commentCount}</div>
            <p className="text-xs text-muted-foreground mt-1.5">Discussion messages</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Project Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={getStatusBadgeVariant(project.status)} className="capitalize">
                  {project.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Priority</span>
                <Badge variant="outline" className={`capitalize ${getPriorityBadgeClass(project.priority)}`}>
                  {project.priority}
                </Badge>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Start Date</span>
                <span className="text-sm">{project.start_date ? new Date(project.start_date).toLocaleDateString() : 'Not set'}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Target End</span>
                <span className="text-sm">{project.target_end_date ? new Date(project.target_end_date).toLocaleDateString() : 'Not set'}</span>
              </div>
              {project.budget_amount && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Budget</span>
                  <span className="text-sm font-medium">${(project.budget_amount / 100).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm">{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {project.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team</CardTitle>
            <CardDescription>{members.length} members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.slice(0, 8).map(member => {
                const name = member.user?.profiles?.name ?? member.user?.email ?? 'Unknown'
                const initials = name.slice(0, 2).toUpperCase()
                return (
                  <div key={member.user_id} className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={member.user?.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                      {member.role.replace('_', ' ')}
                    </Badge>
                  </div>
                )
              })}
              {members.length > 8 && (
                <p className="text-xs text-muted-foreground text-center">+{members.length - 8} more</p>
              )}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No team members assigned.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Tasks + Upcoming */}
      <div className="grid gap-6 lg:grid-cols-2">
        {overdueTasks.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Overdue Tasks ({overdueTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded border border-red-100 bg-red-50/50">
                    <Circle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <Link
                      href={`/dashboard/projects/${project.id}/tasks/${task.id}`}
                      className="text-sm flex-1 truncate hover:underline"
                    >
                      {task.title}
                    </Link>
                    <span className="text-xs text-red-600">
                      {task.due_date && new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={overdueTasks.length === 0 ? 'lg:col-span-2' : ''}>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines.</p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map(task => {
                  const StatusIcon = STATUS_ICONS[task.status] ?? Circle
                  const assigneeName = task.assignee?.profiles?.name ?? task.assignee?.email ?? null

                  return (
                    <div key={task.id} className="flex items-center gap-2 p-2 rounded border">
                      <StatusIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Link
                        href={`/dashboard/projects/${project.id}/tasks/${task.id}`}
                        className="text-sm flex-1 truncate hover:underline"
                      >
                        {task.title}
                      </Link>
                      {assigneeName && (
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[8px]">{assigneeName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {task.due_date && new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
