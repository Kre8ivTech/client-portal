'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format, differenceInDays } from 'date-fns'
import { Clock, Tag, User, AlertCircle, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

interface TicketPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: any | null
}

export function TicketPreviewDialog({ open, onOpenChange, ticket }: TicketPreviewDialogProps) {
  if (!ticket) return null

  const age = differenceInDays(new Date(), new Date(ticket.created_at))
  const isOpen = !['resolved', 'closed'].includes(ticket.status)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs font-mono">
              #{ticket.ticket_number}
            </Badge>
            <Badge className={cn(
              "capitalize",
              ticket.status === 'new' && "bg-blue-100 text-blue-700 hover:bg-blue-100",
              ticket.status === 'open' && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
              ticket.status === 'resolved' && "bg-green-100 text-green-700 hover:bg-green-100",
              ticket.status === 'closed' && "bg-slate-100 text-slate-700 hover:bg-slate-100",
              (ticket.status === 'in_progress' || ticket.status === 'pending_client') && "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
            )}>
              {ticket.status.replace('_', ' ')}
            </Badge>
            {isOpen && (
              <Badge variant="secondary" className={cn(
                "ml-auto",
                age < 3 ? "bg-green-100 text-green-700" :
                age < 7 ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              )}>
                {age} days open
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl leading-tight">
            {ticket.subject}
          </DialogTitle>
          <DialogDescription>
            Created on {format(new Date(ticket.created_at), 'PPP p')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {ticket.description && (
            <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 leading-relaxed max-h-[200px] overflow-y-auto">
              {ticket.description}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Priority:</span>
              <span className="capitalize">{ticket.priority}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Last Updated:</span>
              <span>{ticket.updated_at ? format(new Date(ticket.updated_at), 'MMM d') : '—'}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <Link href={`/dashboard/tickets/${ticket.id}`}>
              View Full Details
              <LinkIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
