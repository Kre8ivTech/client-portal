'use client'

import { useState, useMemo } from 'react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format, differenceInHours, isPast } from 'date-fns'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Database } from '@/types/database'
import { cn } from '@/lib/utils'

type Ticket = Database['public']['Tables']['tickets']['Row']

interface TicketListProps {
  initialTickets: Ticket[]
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_client', label: 'Pending Client' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function TicketList({ initialTickets }: TicketListProps) {
  const supabase = createClient()
  useRealtimeTickets()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

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

  // Filter tickets based on search and filters
  const filteredTickets = useMemo(() => {
    if (!tickets) return []

    return tickets.filter((ticket) => {
      // Search filter
      const matchesSearch =
        searchTerm === '' ||
        ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.ticket_number.toString().includes(searchTerm) ||
        ticket.description?.toLowerCase().includes(searchTerm.toLowerCase())

      // Status filter
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter

      // Priority filter
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [tickets, searchTerm, statusFilter, priorityFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || priorityFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setPriorityFilter('all')
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-6 text-center">
        <p className="font-medium text-destructive">Failed to load tickets.</p>
        <p className="text-sm text-slate-600 mt-1">{error?.message ?? 'Please refresh the page.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-sm text-slate-500">
          Showing {filteredTickets.length} of {tickets?.length ?? 0} tickets
        </p>
      )}

      {/* Table */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold w-[100px]">ID</TableHead>
              <TableHead className="font-semibold">Subject</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Priority</TableHead>
              <TableHead className="font-semibold">Due Date</TableHead>
              <TableHead className="font-semibold text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500 italic">
                  {hasActiveFilters ? 'No tickets match your filters.' : 'No tickets found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => {
                const dueStatus = getDueStatus(ticket.sla_due_at)
                return (
                  <TableRow
                    key={ticket.id}
                    className={cn(
                      'transition-colors',
                      dueStatus === 'overdue' && 'bg-red-50 hover:bg-red-100',
                      dueStatus === 'due-soon' && 'bg-orange-50 hover:bg-orange-100',
                      dueStatus === 'due-upcoming' && 'bg-yellow-50 hover:bg-yellow-100',
                      dueStatus === 'on-track' && 'hover:bg-slate-50',
                      dueStatus === 'none' && 'hover:bg-slate-50'
                    )}
                  >
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
                    <TableCell>
                      <DueDateBadge dueDate={ticket.sla_due_at} status={ticket.status} />
                    </TableCell>
                    <TableCell className="text-right text-slate-500 text-sm whitespace-nowrap">
                      {ticket.created_at ? formatDate(ticket.created_at) : '—'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

type DueStatus = 'overdue' | 'due-soon' | 'due-upcoming' | 'on-track' | 'none'

function getDueStatus(dueDate: string | null): DueStatus {
  if (!dueDate) return 'none'

  const due = new Date(dueDate)
  const now = new Date()

  if (isPast(due)) return 'overdue'

  const hoursUntilDue = differenceInHours(due, now)

  if (hoursUntilDue <= 24) return 'due-soon'
  if (hoursUntilDue <= 72) return 'due-upcoming'
  return 'on-track'
}

function DueDateBadge({ dueDate, status }: { dueDate: string | null; status: string }) {
  // Don't show due date indicator for resolved/closed tickets
  if (status === 'resolved' || status === 'closed') {
    return dueDate ? (
      <span className="text-sm text-slate-400">{formatDate(dueDate)}</span>
    ) : (
      <span className="text-sm text-slate-400">—</span>
    )
  }

  if (!dueDate) {
    return <span className="text-sm text-slate-400">No deadline</span>
  }

  const dueStatus = getDueStatus(dueDate)

  const styles: Record<DueStatus, string> = {
    overdue: 'bg-red-100 text-red-700 border-red-300',
    'due-soon': 'bg-orange-100 text-orange-700 border-orange-300',
    'due-upcoming': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'on-track': 'bg-green-100 text-green-700 border-green-300',
    none: '',
  }

  const labels: Record<DueStatus, string> = {
    overdue: 'Overdue',
    'due-soon': 'Due soon',
    'due-upcoming': 'Upcoming',
    'on-track': 'On track',
    none: '',
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className={cn('text-xs font-medium py-0.5', styles[dueStatus])}>
        {labels[dueStatus]}
      </Badge>
      <span className="text-xs text-slate-500">{formatDate(dueDate)}</span>
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

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  open: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  pending_client: 'bg-orange-50 text-orange-700 border-orange-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  return (
    <Badge variant="outline" className={`${STATUS_STYLES[status] ?? STATUS_STYLES.new} font-medium capitalize py-0.5`}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-50 text-slate-600 border-slate-200',
  medium: 'bg-blue-50 text-blue-600 border-blue-200',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  critical: 'bg-red-50 text-red-600 border-red-200',
}

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  return (
    <Badge variant="outline" className={`${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium} font-medium capitalize py-0.5`}>
      {priority}
    </Badge>
  )
}
