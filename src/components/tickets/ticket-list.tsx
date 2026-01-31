'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeTickets } from '@/hooks/use-realtime-tickets'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import Link from 'next/link'
import { Database } from '@/types/database'

type Ticket = Database['public']['Tables']['tickets']['Row']

interface TicketListProps {
  initialTickets: Ticket[]
}

export function TicketList({ initialTickets }: TicketListProps) {
  const supabase = createClient()
  useRealtimeTickets()

  const { data: tickets, isError, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    initialData: initialTickets,
  })

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-6 text-center">
        <p className="font-medium text-destructive">Failed to load tickets.</p>
        <p className="text-sm text-slate-600 mt-1">{error?.message ?? 'Please refresh the page.'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold w-[100px]">ID</TableHead>
            <TableHead className="font-semibold">Subject</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Priority</TableHead>
            <TableHead className="font-semibold text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-slate-500 italic">
                No tickets found.
              </TableCell>
            </TableRow>
          ) : (
            tickets?.map((ticket) => (
              <TableRow key={ticket.id} className="hover:bg-slate-50 transition-colors">
                <TableCell className="font-mono text-xs text-slate-500 uppercase">
                  #{ticket.ticket_number}
                </TableCell>
                <TableCell className="font-medium">
                  <Link 
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="hover:text-primary transition-colors block"
                  >
                    {ticket.subject}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={ticket.priority} />
                </TableCell>
                <TableCell className="text-right text-slate-500 text-sm whitespace-nowrap">
                  {formatDate(ticket.created_at)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function formatDate(date: string) {
  try {
    return format(new Date(date), 'MMM d, yyyy')
  } catch {
    return 'Pending'
  }
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const styles = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    open: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    pending_client: 'bg-orange-50 text-orange-700 border-orange-200',
    resolved: 'bg-green-50 text-green-700 border-green-200',
    closed: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <Badge variant="outline" className={`${styles[status]} font-medium capitalize py-0.5`}>
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
    <Badge variant="outline" className={`${styles[priority]} font-medium capitalize py-0.5`}>
      {priority}
    </Badge>
  )
}
