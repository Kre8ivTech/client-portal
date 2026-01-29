'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ArrowLeft,
  Clock,
  User,
  Calendar,
  Tag,
  AlertCircle,
  CheckCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { cn, formatDateTime, formatDistanceToNow } from '@/lib/utils'
import type { 
  TicketWithRelations, 
  TicketPriority, 
  TicketStatus,
} from '@/types/tickets'

interface TicketDetailProps {
  ticket: TicketWithRelations
  onBack?: () => void
  onStatusChange?: (status: TicketStatus) => void
  onAssign?: () => void
  onEdit?: () => void
  onDelete?: () => void
  isStaff?: boolean
  className?: string
}

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const statusLabels: Record<TicketStatus, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In Progress',
  pending_client: 'Pending Client',
  resolved: 'Resolved',
  closed: 'Closed',
}

const statusActions: Record<TicketStatus, { next: TicketStatus[]; labels: Partial<Record<TicketStatus, string>> }> = {
  new: { 
    next: ['open', 'in_progress'], 
    labels: { open: 'Mark as Open', in_progress: 'Start Working' } 
  },
  open: { 
    next: ['in_progress', 'pending_client', 'resolved'], 
    labels: { in_progress: 'Start Working', pending_client: 'Waiting on Client', resolved: 'Mark Resolved' } 
  },
  in_progress: { 
    next: ['pending_client', 'resolved'], 
    labels: { pending_client: 'Waiting on Client', resolved: 'Mark Resolved' } 
  },
  pending_client: { 
    next: ['in_progress', 'resolved'], 
    labels: { in_progress: 'Resume Work', resolved: 'Mark Resolved' } 
  },
  resolved: { 
    next: ['closed', 'open'], 
    labels: { closed: 'Close Ticket', open: 'Reopen' } 
  },
  closed: { 
    next: ['open'], 
    labels: { open: 'Reopen Ticket' } 
  },
}

export function TicketDetail({
  ticket,
  onBack,
  onStatusChange,
  onAssign,
  onEdit,
  onDelete,
  isStaff = false,
  className,
}: TicketDetailProps) {
  const [showActions, setShowActions] = useState(false)

  const createdByName = ticket.created_by_profile?.name || ticket.created_by_profile?.email || 'Unknown'
  const assignedToName = ticket.assigned_to_profile?.name || ticket.assigned_to_profile?.email

  const availableStatusChanges = statusActions[ticket.status]

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0 mt-1"
            >
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-slate-500">
                {ticket.ticket_number}
              </span>
              <Badge variant={ticket.priority}>
                {priorityLabels[ticket.priority]}
              </Badge>
              <Badge variant={ticket.status}>
                {statusLabels[ticket.status]}
              </Badge>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              {ticket.subject}
            </h1>
          </div>
        </div>

        {/* Actions menu */}
        {isStaff && (
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreHorizontal size={18} />
            </Button>
            
            {showActions && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border rounded-lg shadow-lg py-1 z-10">
                {onEdit && (
                  <button
                    onClick={() => { onEdit(); setShowActions(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit size={16} />
                    Edit Ticket
                  </button>
                )}
                {onAssign && (
                  <button
                    onClick={() => { onAssign(); setShowActions(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <UserPlus size={16} />
                    {ticket.assigned_to ? 'Reassign' : 'Assign'}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => { onDelete(); setShowActions(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    Delete Ticket
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Queue position banner */}
      {ticket.queue_position && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">#{ticket.queue_position}</span>
            </div>
            <div>
              <p className="font-medium text-primary">Queue Position</p>
              <p className="text-sm text-primary/70">
                Your ticket is #{ticket.queue_position} in the {ticket.priority} priority queue
              </p>
            </div>
          </div>
          {ticket.sla_due_at && (
            <div className="text-right hidden md:block">
              <p className="text-sm text-slate-500">Expected response by</p>
              <p className="font-medium text-slate-700">{formatDateTime(ticket.sla_due_at)}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-slate prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Status change actions */}
          {onStatusChange && availableStatusChanges.next.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {availableStatusChanges.next.map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant={nextStatus === 'resolved' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onStatusChange(nextStatus)}
                    >
                      {nextStatus === 'resolved' && <CheckCircle size={16} className="mr-1" />}
                      {nextStatus === 'closed' && <XCircle size={16} className="mr-1" />}
                      {availableStatusChanges.labels[nextStatus] || statusLabels[nextStatus]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Created by */}
              <div className="flex items-start gap-3">
                <User size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Created by</p>
                  <p className="font-medium">{createdByName}</p>
                </div>
              </div>

              {/* Assigned to */}
              <div className="flex items-start gap-3">
                <UserPlus size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Assigned to</p>
                  <p className="font-medium">
                    {assignedToName || <span className="text-slate-400">Unassigned</span>}
                  </p>
                </div>
              </div>

              {/* Category */}
              {ticket.category && (
                <div className="flex items-start gap-3">
                  <Tag size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Category</p>
                    <p className="font-medium capitalize">{ticket.category.replace(/-/g, ' ')}</p>
                  </div>
                </div>
              )}

              {/* Created */}
              <div className="flex items-start gap-3">
                <Calendar size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Created</p>
                  <p className="font-medium">{formatDateTime(ticket.created_at)}</p>
                  <p className="text-xs text-slate-400">{formatDistanceToNow(ticket.created_at)}</p>
                </div>
              </div>

              {/* Last updated */}
              <div className="flex items-start gap-3">
                <Clock size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Last updated</p>
                  <p className="font-medium">{formatDistanceToNow(ticket.updated_at)}</p>
                </div>
              </div>

              {/* First response */}
              {ticket.first_response_at && (
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">First response</p>
                    <p className="font-medium">{formatDistanceToNow(ticket.first_response_at)}</p>
                  </div>
                </div>
              )}

              {/* Resolved at */}
              {ticket.resolved_at && (
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Resolved</p>
                    <p className="font-medium">{formatDateTime(ticket.resolved_at)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {ticket.tags && ticket.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {ticket.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
