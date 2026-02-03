'use client'

import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Clock, MessageSquare, Bug, Sparkles, FileText, Search, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

type TaskAssignee = {
  id: string
  email: string
  profiles: { name: string | null; avatar_url: string | null } | null
}

export type Task = {
  id: string
  task_number: number
  title: string
  description: string | null
  status: string
  priority: string
  task_type: string
  due_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  assignee: TaskAssignee | null
  milestone: { id: string; name: string } | null
  _count?: { count: number }[]
  tags?: string[]
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
  isDragging?: boolean
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-500'
    case 'high':
      return 'bg-orange-500'
    case 'medium':
      return 'bg-blue-500'
    case 'low':
      return 'bg-slate-400'
    default:
      return 'bg-slate-400'
  }
}

function getTaskTypeIcon(type: string) {
  switch (type) {
    case 'bug':
      return <Bug className="h-3.5 w-3.5 text-red-500" />
    case 'feature':
      return <Sparkles className="h-3.5 w-3.5 text-purple-500" />
    case 'improvement':
      return <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
    case 'documentation':
      return <FileText className="h-3.5 w-3.5 text-blue-500" />
    case 'research':
      return <Search className="h-3.5 w-3.5 text-green-500" />
    default:
      return null
  }
}

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const assigneeName = task.assignee?.profiles?.name ?? task.assignee?.email ?? null
  const assigneeInitials = assigneeName?.slice(0, 2).toUpperCase() ?? '?'
  const commentCount = task._count?.[0]?.count ?? 0

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 bg-white rounded-lg border shadow-sm cursor-pointer',
        'hover:shadow-md hover:border-slate-300 transition-all',
        isDragging && 'shadow-lg rotate-2 opacity-90'
      )}
    >
      {/* Priority indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-1.5 h-1.5 rounded-full', getPriorityColor(task.priority))} />
        <span className="text-xs text-slate-400 font-mono">#{task.task_number}</span>
        {getTaskTypeIcon(task.task_type)}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-slate-900 line-clamp-2 mb-2">
        {task.title}
      </h4>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 2).map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {task.tags.length > 2 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              +{task.tags.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Meta info */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {task.due_date && (
            <div className={cn('flex items-center gap-1', isOverdue && 'text-red-500')}>
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(task.due_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
          {task.estimated_hours && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{task.actual_hours ?? 0}/{task.estimated_hours}h</span>
            </div>
          )}
          {commentCount > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{commentCount}</span>
            </div>
          )}
        </div>

        {/* Assignee */}
        {task.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={task.assignee.profiles?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs bg-slate-100">
              {assigneeInitials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}
