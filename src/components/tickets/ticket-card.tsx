'use client'

import { formatDistanceToNow } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  Clock, 
  User,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 
  TicketWithRelations, 
  TicketPriority, 
  TicketStatus,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
} from '@/types/tickets'

interface TicketCardProps {
  ticket: TicketWithRelations
  onClick?: () => void
  showOrganization?: boolean
  className?: string
}

// Priority labels for display
const priorityLabels: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

// Status labels for display
const statusLabels: Record<TicketStatus, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In Progress',
  pending_client: 'Pending Client',
  resolved: 'Resolved',
  closed: 'Closed',
}

export function TicketCard({ 
  ticket, 
  onClick, 
  showOrganization = false,
  className,
}: TicketCardProps) {
  const createdByName = ticket.created_by_profile?.name || ticket.created_by_profile?.email || 'Unknown'
  const assignedToName = ticket.assigned_to_profile?.name || ticket.assigned_to_profile?.email
  
  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-slate-300',
        'active:scale-[0.99] active:bg-slate-50',
        'md:hover:translate-x-1',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 md:p-5">
        {/* Top row: Ticket number + Priority + Status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-slate-500 shrink-0">
              {ticket.ticket_number}
            </span>
            {showOrganization && ticket.organization && (
              <span className="text-xs text-slate-400 truncate">
                {ticket.organization.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={ticket.priority}>
              {priorityLabels[ticket.priority]}
            </Badge>
            <Badge variant={ticket.status}>
              {statusLabels[ticket.status]}
            </Badge>
          </div>
        </div>

        {/* Subject */}
        <h3 className="font-medium text-slate-900 line-clamp-2 mb-2 pr-4">
          {ticket.subject}
        </h3>

        {/* Description preview - only on larger screens */}
        <p className="hidden md:block text-sm text-slate-500 line-clamp-2 mb-3">
          {ticket.description}
        </p>

        {/* Bottom row: Meta info */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            {/* Created by */}
            <div className="flex items-center gap-1">
              <User size={14} className="text-slate-400" />
              <span className="truncate max-w-[100px]">{createdByName}</span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-1">
              <Clock size={14} className="text-slate-400" />
              <span>{formatDistanceToNow(ticket.created_at)}</span>
            </div>

            {/* Comments count */}
            {ticket.comments_count !== undefined && ticket.comments_count > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare size={14} className="text-slate-400" />
                <span>{ticket.comments_count}</span>
              </div>
            )}
          </div>

          {/* Queue position - if available */}
          {ticket.queue_position && (
            <div className="flex items-center gap-1 text-primary font-medium">
              <span>#{ticket.queue_position} in queue</span>
            </div>
          )}

          {/* Chevron for navigation hint on mobile */}
          <ChevronRight size={18} className="text-slate-300 md:hidden" />
        </div>

        {/* Assigned to - if assigned */}
        {assignedToName && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-500">
            <span>Assigned to:</span>
            <span className="font-medium text-slate-700">{assignedToName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for sidebars or widgets
export function TicketCardCompact({ 
  ticket, 
  onClick,
  className,
}: Omit<TicketCardProps, 'showOrganization'>) {
  return (
    <div 
      className={cn(
        'p-3 rounded-lg border border-slate-200 cursor-pointer',
        'hover:bg-slate-50 hover:border-slate-300 transition-colors',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-mono text-slate-500">
          {ticket.ticket_number}
        </span>
        <Badge variant={ticket.priority} className="text-[10px] px-1.5 py-0">
          {priorityLabels[ticket.priority]}
        </Badge>
      </div>
      <h4 className="text-sm font-medium text-slate-900 line-clamp-1">
        {ticket.subject}
      </h4>
      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
        <Badge variant={ticket.status} className="text-[10px] px-1.5 py-0">
          {statusLabels[ticket.status]}
        </Badge>
        <span>{formatDistanceToNow(ticket.created_at)}</span>
      </div>
    </div>
  )
}
