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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, differenceInHours, isPast } from 'date-fns'
import Link from 'next/link'
import { Search, X, Filter, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PriorityIndicator, PriorityDot } from './priority-indicator'
import {
  getPriorityConfig,
  getPrioritiesByUrgency,
  formatResponseTime,
  isUrgentPriority,
  PRIORITY_CONFIG,
  type TicketPriority,
} from '@/lib/ticket-priority'
import { Database } from '@/types/database'

type Ticket = Database['public']['Tables']['tickets']['Row']

interface TicketWithRelations extends Ticket {
  created_by_user?: {
    id: string
    profiles?: { name: string | null } | null
  } | null
  assigned_to_user?: {
    id: string
    profiles?: { name: string | null } | null
  } | null
}

interface StaffTicketListProps {
  initialTickets: TicketWithRelations[]
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

const ASSIGNMENT_OPTIONS = [
  { value: 'all', label: 'All Tickets' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
]

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  open: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  pending_client: 'bg-orange-50 text-orange-700 border-orange-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function StaffTicketList({ initialTickets }: StaffTicketListProps) {
  const supabase = createClient()
  useRealtimeTickets()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [assignmentFilter, setAssignmentFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'priority' | 'created' | 'due'>('priority')

  const { data: tickets, isError, error } = useQuery({
    queryKey: ['staff-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          created_by_user:users!created_by(id, profiles(name)),
          assigned_to_user:users!assigned_to(id, profiles(name))
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as TicketWithRelations[]
    },
    initialData: initialTickets,
  })

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    if (!tickets) return []

    let filtered = tickets.filter((ticket) => {
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

      // Assignment filter
      const matchesAssignment =
        assignmentFilter === 'all' ||
        (assignmentFilter === 'unassigned' && !ticket.assigned_to) ||
        (assignmentFilter === 'assigned' && ticket.assigned_to)

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignment
    })

    // Sort tickets
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder: Record<string, number> = {
          critical: 1,
          high: 2,
          medium: 3,
          low: 4,
        }
        const aPriority = priorityOrder[a.priority ?? 'medium'] ?? 3
        const bPriority = priorityOrder[b.priority ?? 'medium'] ?? 3
        if (aPriority !== bPriority) return aPriority - bPriority
        // Secondary sort by created date for same priority
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      }
      if (sortBy === 'due') {
        if (!a.sla_due_at && !b.sla_due_at) return 0
        if (!a.sla_due_at) return 1
        if (!b.sla_due_at) return -1
        return new Date(a.sla_due_at).getTime() - new Date(b.sla_due_at).getTime()
      }
      // Default: created date
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    })

    return filtered
  }, [tickets, searchTerm, statusFilter, priorityFilter, assignmentFilter, sortBy])

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    assignmentFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setAssignmentFilter('all')
  }

  // Priority summary counts
  const priorityCounts = useMemo(() => {
    if (!tickets) return { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    const activeTickets = tickets.filter(
      (t) => !['resolved', 'closed'].includes(t.status ?? '')
    )
    return {
      critical: activeTickets.filter((t) => t.priority === 'critical').length,
      high: activeTickets.filter((t) => t.priority === 'high').length,
      medium: activeTickets.filter((t) => t.priority === 'medium').length,
      low: activeTickets.filter((t) => t.priority === 'low').length,
      total: activeTickets.length,
    }
  }, [tickets])

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-6 text-center">
        <p className="font-medium text-destructive">Failed to load tickets.</p>
        <p className="text-sm text-slate-600 mt-1">
          {error?.message ?? 'Please refresh the page.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Priority Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <PrioritySummaryCard
          priority="critical"
          count={priorityCounts.critical}
          onClick={() => setPriorityFilter('critical')}
          isActive={priorityFilter === 'critical'}
        />
        <PrioritySummaryCard
          priority="high"
          count={priorityCounts.high}
          onClick={() => setPriorityFilter('high')}
          isActive={priorityFilter === 'high'}
        />
        <PrioritySummaryCard
          priority="medium"
          count={priorityCounts.medium}
          onClick={() => setPriorityFilter('medium')}
          isActive={priorityFilter === 'medium'}
        />
        <PrioritySummaryCard
          priority="low"
          count={priorityCounts.low}
          onClick={() => setPriorityFilter('low')}
          isActive={priorityFilter === 'low'}
        />
        <Card
          className={cn(
            'cursor-pointer transition-all',
            priorityFilter === 'all' && 'ring-2 ring-primary'
          )}
          onClick={() => setPriorityFilter('all')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              All Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{priorityCounts.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by subject, ticket #, or description..."
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
                  <div className="flex items-center gap-2">
                    {option.value !== 'all' && (
                      <PriorityDot priority={option.value} size="sm" />
                    )}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Assignment" />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNMENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <div className="flex gap-1">
              <Button
                variant={sortBy === 'priority' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSortBy('priority')}
              >
                Priority
              </Button>
              <Button
                variant={sortBy === 'created' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSortBy('created')}
              >
                Created
              </Button>
              <Button
                variant={sortBy === 'due' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSortBy('due')}
              >
                Due Date
              </Button>
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-sm text-slate-500">
          Showing {filteredTickets.length} of {tickets?.length ?? 0} tickets
        </p>
      )}

      {/* Priority Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border rounded-lg p-3 bg-muted/30">
        <span className="font-medium">Response Times:</span>
        {getPrioritiesByUrgency().map((config) => (
          <div key={config.value} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', config.colors.dot)} />
            <span>
              {config.label}: {formatResponseTime(config.firstResponseHours)}
            </span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold w-[60px]">Priority</TableHead>
              <TableHead className="font-semibold w-[100px]">ID</TableHead>
              <TableHead className="font-semibold">Subject</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Requester</TableHead>
              <TableHead className="font-semibold">Assigned To</TableHead>
              <TableHead className="font-semibold">Due Date</TableHead>
              <TableHead className="font-semibold text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-slate-500 italic">
                  {hasActiveFilters ? 'No tickets match your filters.' : 'No tickets found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => {
                const priorityConfig = getPriorityConfig(ticket.priority)
                const dueStatus = getDueStatus(ticket.sla_due_at)
                const isActive = !['resolved', 'closed'].includes(ticket.status ?? '')

                return (
                  <TableRow
                    key={ticket.id}
                    className={cn(
                      'transition-colors',
                      isActive && isUrgentPriority(ticket.priority) && priorityConfig.colors.row,
                      isActive && isUrgentPriority(ticket.priority) && priorityConfig.colors.rowHover,
                      !isActive && 'opacity-60',
                      !isUrgentPriority(ticket.priority) && 'hover:bg-slate-50'
                    )}
                  >
                    <TableCell>
                      <PriorityIndicator priority={ticket.priority} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 uppercase">
                      #{ticket.ticket_number}
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px]">
                      <Link
                        href={`/dashboard/tickets/${ticket.id}`}
                        className="hover:text-primary transition-colors block truncate"
                      >
                        {ticket.subject}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {ticket.created_by_user?.profiles?.name ?? 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ticket.assigned_to_user?.profiles?.name ?? (
                        <span className="text-orange-600 font-medium">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DueDateBadge dueDate={ticket.sla_due_at} status={ticket.status ?? 'new'} />
                    </TableCell>
                    <TableCell className="text-right text-slate-500 text-sm whitespace-nowrap">
                      {ticket.created_at ? formatDate(ticket.created_at) : '-'}
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

interface PrioritySummaryCardProps {
  priority: TicketPriority
  count: number
  onClick: () => void
  isActive: boolean
}

function PrioritySummaryCard({ priority, count, onClick, isActive }: PrioritySummaryCardProps) {
  const config = PRIORITY_CONFIG[priority]

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all',
        config.colors.row,
        config.colors.rowHover,
        isActive && 'ring-2 ring-primary'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', config.colors.dot)} />
          {config.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className={cn('text-2xl font-bold', config.colors.text)}>{count}</p>
          <p className="text-xs text-muted-foreground">
            {formatResponseTime(config.firstResponseHours)} SLA
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

type DueStatus = 'overdue' | 'due-soon' | 'due-upcoming' | 'on-track' | 'none'

function getDueStatus(dueDate: string | null): DueStatus {
  if (!dueDate) return 'none'

  const due = new Date(dueDate)
  const now = new Date()

  if (isPast(due)) return 'overdue'

  const hoursUntilDue = differenceInHours(due, now)

  if (hoursUntilDue <= 4) return 'due-soon'
  if (hoursUntilDue <= 24) return 'due-upcoming'
  return 'on-track'
}

function DueDateBadge({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (status === 'resolved' || status === 'closed') {
    return dueDate ? (
      <span className="text-sm text-slate-400">{formatDate(dueDate)}</span>
    ) : (
      <span className="text-sm text-slate-400">-</span>
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
        {dueStatus === 'overdue' && <AlertTriangle className="h-3 w-3 mr-1" />}
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

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const safeStatus = status ?? 'new'
  return (
    <Badge
      variant="outline"
      className={cn(
        STATUS_STYLES[safeStatus] ?? STATUS_STYLES.new,
        'font-medium capitalize py-0.5'
      )}
    >
      {safeStatus.replace('_', ' ')}
    </Badge>
  )
}
