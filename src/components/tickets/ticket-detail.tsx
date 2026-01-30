'use client'

import { useMemo, useState } from 'react'
import { TicketComments } from './ticket-comments'
import { TicketAttachments } from './ticket-attachments'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { Calendar, User, Tag, Clock, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Database } from '@/types/database'

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  creator?: {
    name: string | null
  }
}

interface TicketDetailProps {
  ticket: Ticket
  userId: string
  userRole: string
  organizationId: string
  queuePosition?: number | null
  queueTotal?: number | null
}

export function TicketDetail({
  ticket,
  userId,
  userRole,
  organizationId,
  queuePosition,
  queueTotal,
}: TicketDetailProps) {
  const [status, setStatus] = useState<Ticket['status']>(ticket.status)
  const [selectedStatus, setSelectedStatus] = useState<Ticket['status']>(ticket.status)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusOptions = useMemo(
    () => [
      { value: 'new', label: 'New' },
      { value: 'open', label: 'Open' },
      { value: 'in_progress', label: 'In progress' },
      { value: 'pending_client', label: 'Pending client' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'closed', label: 'Closed' },
    ],
    []
  )

  const transitionMap: Record<Ticket['status'], Ticket['status'][]> = {
    new: ['open', 'in_progress', 'pending_client', 'resolved', 'closed'],
    open: ['in_progress', 'pending_client', 'resolved', 'closed'],
    in_progress: ['pending_client', 'resolved', 'closed'],
    pending_client: ['in_progress', 'resolved', 'closed'],
    resolved: ['closed', 'open', 'in_progress'],
    closed: [],
  }

  const allowedStatuses =
    userRole === 'client'
      ? ['closed']
      : [status, ...(transitionMap[status] || [])]

  const canCloseTicket = userRole === 'client' && status !== 'closed'

  const updateStatus = async (nextStatus: Ticket['status']) => {
    setError(null)
    setIsUpdating(true)

    const response = await fetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: nextStatus }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to update ticket status')
      setIsUpdating(false)
      return
    }

    setStatus(payload.data.status)
    setSelectedStatus(payload.data.status)
    setIsUpdating(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link 
        href="/dashboard/tickets" 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Tickets
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Ticket #{ticket.ticket_number}
            </span>
            <StatusBadge status={status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="h-3 w-3" />
                </div>
                <span className="font-semibold">{ticket.creator?.name || 'Anonymous'}</span>
                <span className="text-slate-400">•</span>
                <span>Original Request</span>
              </div>
              <span className="text-xs text-slate-400">
                {format(new Date(ticket.created_at), 'MMMM d, yyyy h:mm a')}
              </span>
            </div>
            <CardContent className="p-6">
              <div className="prose prose-slate max-w-none prose-sm whitespace-pre-wrap text-slate-700 leading-relaxed">
                {ticket.description}
              </div>
            </CardContent>
          </Card>

          <TicketComments ticketId={ticket.id} userId={userId} />
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 border-b pb-3">Details</h3>
            
            <DetailItem 
              icon={<Clock className="h-4 w-4 text-slate-400" />} 
              label="Last Updated" 
              value={format(new Date(ticket.updated_at), 'MMM d, h:mm a')} 
            />
            
            <DetailItem 
              icon={<Calendar className="h-4 w-4 text-slate-400" />} 
              label="SLA Deadline" 
              value={ticket.sla_due_at ? format(new Date(ticket.sla_due_at), 'MMM d, yyyy') : 'No deadline'} 
            />
            
            <DetailItem 
              icon={<Tag className="h-4 w-4 text-slate-400" />} 
              label="Category" 
              value={ticket.category || 'Uncategorized'} 
            />

            <DetailItem
              icon={<Clock className="h-4 w-4 text-slate-400" />}
              label="Queue Position"
              value={
                queuePosition !== null &&
                queuePosition !== undefined &&
                queueTotal !== null &&
                queueTotal !== undefined
                  ? `#${queuePosition} of ${queueTotal}`
                  : 'Not in queue'
              }
            />
            
            <div className="pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter mb-2 block">Tags</span>
              <div className="flex flex-wrap gap-1">
                {(ticket.tags as string[])?.length > 0 ? (
                  (ticket.tags as string[]).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px] font-bold uppercase">{tag}</Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No tags</span>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter block">Status</span>
              {userRole === 'client' ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => updateStatus('closed')}
                  disabled={!canCloseTicket || isUpdating}
                >
                  {isUpdating ? 'Closing ticket...' : 'Close Ticket'}
                </Button>
              ) : (
                <div className="space-y-3">
                  <Select
                    value={selectedStatus}
                    onValueChange={(value) => setSelectedStatus(value as Ticket['status'])}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions
                        .filter((option) => allowedStatuses.includes(option.value))
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => updateStatus(selectedStatus)}
                    disabled={isUpdating || selectedStatus === status}
                  >
                    {isUpdating ? 'Updating status...' : 'Update Status'}
                  </Button>
                </div>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Unable to update ticket</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <TicketAttachments
              ticketId={ticket.id}
              organizationId={organizationId}
              userId={userId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="space-y-0.5">
        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">{label}</span>
        <span className="text-sm font-semibold text-slate-700">{value}</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const styles = {
    new: 'bg-blue-100 text-blue-700 border-blue-200',
    open: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    pending_client: 'bg-orange-100 text-orange-700 border-orange-200',
    resolved: 'bg-green-100 text-green-700 border-green-200',
    closed: 'bg-slate-200 text-slate-700 border-slate-300',
  }

  return (
    <Badge className={`${styles[status]} font-bold capitalize px-2.5 py-0.5 rounded-full border shadow-sm text-[11px]`}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  const styles = {
    low: 'bg-slate-50 text-slate-600 border-slate-200',
    medium: 'bg-blue-50 text-blue-600 border-blue-200',
    high: 'bg-orange-50 text-orange-600 border-orange-200',
    critical: 'bg-red-50 text-red-600 border-red-200',
  }

  return (
    <Badge variant="outline" className={`${styles[priority]} font-bold capitalize px-2.5 py-0.5 rounded-full text-[11px] shadow-sm`}>
      {priority}
    </Badge>
  )
}
