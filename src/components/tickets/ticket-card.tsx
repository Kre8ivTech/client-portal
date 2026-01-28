import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'

type Ticket = Database['public']['Tables']['tickets']['Row']

interface TicketCardProps {
  ticket: Ticket
  onClick?: () => void
}

function getPriorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case 'critical':
      return 'destructive'
    case 'high':
      return 'destructive' // or maybe a specific high color if we had one
    case 'medium':
      return 'secondary'
    case 'low':
      return 'outline'
    default:
      return 'default'
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'new': return 'bg-blue-500'
    case 'open': return 'bg-green-500'
    case 'in_progress': return 'bg-yellow-500'
    case 'pending_client': return 'bg-purple-500'
    case 'resolved': return 'bg-gray-500'
    case 'closed': return 'bg-slate-300'
    default: return 'bg-gray-500'
  }
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        // Mobile first - base styles
        "p-4 cursor-pointer active:bg-slate-50 transition-colors",
        // Tablet and up
        "md:p-6 md:hover:shadow-md md:transition-shadow"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("w-2 h-2 rounded-full", getStatusColor(ticket.status))} />
            <span className="text-xs text-muted-foreground font-mono">
              #{ticket.ticket_number}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
            </span>
          </div>
          <h3 className="font-medium truncate text-base mb-1">{ticket.subject}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {ticket.description}
          </p>
        </div>
        <Badge variant={getPriorityVariant(ticket.priority)} className="capitalize shrink-0">
          {ticket.priority}
        </Badge>
      </div>

      {ticket.queue_position && (
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit">
           <span>Queue Position:</span>
           <span className="text-primary">#{ticket.queue_position}</span>
        </div>
      )}
    </Card>
  )
}
