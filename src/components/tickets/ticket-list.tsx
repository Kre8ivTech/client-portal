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
import { useRouter } from 'next/navigation'
import { Search, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Database } from '@/types/database'
import { cn } from '@/lib/utils'
import { getCombinedSLAStatus, getSLARowColor } from '@/lib/sla-status'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  first_response_due_at?: string | null
  organization?: {
    id: string
    name: string
    is_priority_client?: boolean
  }
}

interface TicketListProps {
  initialTickets: Ticket[]
  organizations?: Array<{ id: string; name: string }>
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

const SLA_FILTER_OPTIONS = [
  { value: 'all', label: 'All SLA Status' },
  { value: 'breach', label: 'Breached' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'At Risk' },
  { value: 'on-track', label: 'On Track' },
]

export function TicketList({ initialTickets, organizations }: TicketListProps) {
  const supabase = createClient()
  useRealtimeTickets()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [slaFilter, setSlaFilter] = useState('all')

  const ticketSelect = organizations && organizations.length > 0
    ? `
        *,
        organization:organizations(id, name, is_priority_client)
      `
    : `
        *,
        organization:organizations(id, name)
      `

  const { data: tickets, isError, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(ticketSelect)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Ticket[]
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
        ticket.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.organization?.name.toLowerCase().includes(searchTerm.toLowerCase())

      // Status filter
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter

      // Priority filter
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter

      // Client filter
      const matchesClient = clientFilter === 'all' || ticket.organization_id === clientFilter

      // SLA filter
      let matchesSLA = true
      if (slaFilter !== 'all') {
        const slaStatus = getCombinedSLAStatus(
          ticket.created_at,
          ticket.first_response_due_at ?? null,
          ticket.first_response_at,
          ticket.sla_due_at,
          ticket.resolved_at,
          ticket.status
        )
        matchesSLA = slaStatus.status === slaFilter
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesClient && matchesSLA
    })
  }, [tickets, searchTerm, statusFilter, priorityFilter, clientFilter, slaFilter])

  // Separate priority tickets (Critical/High) from others
  const { priorityTickets, otherTickets } = useMemo(() => {
    const priority: Ticket[] = []
    const other: Ticket[] = []

    filteredTickets.forEach((ticket) => {
      // Only separate if we're not filtering by a specific priority
      // If user filters for "Low", we shouldn't show a empty "High" table
      if (priorityFilter === 'all' && (ticket.priority === 'critical' || ticket.priority === 'high')) {
        priority.push(ticket)
      } else {
        other.push(ticket)
      }
    })

    return { priorityTickets: priority, otherTickets: other }
  }, [filteredTickets, priorityFilter])

  const hasActiveFilters = 
    searchTerm !== '' || 
    statusFilter !== 'all' || 
    priorityFilter !== 'all' || 
    clientFilter !== 'all' || 
    slaFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setClientFilter('all')
    setSlaFilter('all')
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search tickets, clients..."
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
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          {organizations && organizations.length > 0 && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Select value={slaFilter} onValueChange={setSlaFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="SLA Status" />
            </SelectTrigger>
            <SelectContent>
              {SLA_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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

      {/* Priority Tickets Table */}
      {priorityTickets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-lg text-slate-900">Priority Tickets</h3>
          </div>
          <TicketTable 
            tickets={priorityTickets} 
            showOrgColumn={true} 
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      )}

      {/* Other Tickets Table */}
      <div className="space-y-2">
        {priorityTickets.length > 0 && (
          <h3 className="font-semibold text-lg text-slate-900">All Tickets</h3>
        )}
        <TicketTable 
          tickets={otherTickets} 
          showOrgColumn={true}
          hasActiveFilters={hasActiveFilters}
        />
      </div>
    </div>
  )
}

function TicketTable({ 
  tickets, 
  showOrgColumn,
  hasActiveFilters 
}: { 
  tickets: Ticket[]
  showOrgColumn: boolean
  hasActiveFilters: boolean
}) {
  const router = useRouter()

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold w-[100px]">ID</TableHead>
            <TableHead className="font-semibold">Subject</TableHead>
            {showOrgColumn && (
              <TableHead className="font-semibold">Client</TableHead>
            )}
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Priority</TableHead>
            <TableHead className="font-semibold">SLA Status</TableHead>
            <TableHead className="font-semibold text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showOrgColumn ? 7 : 6} className="h-32 text-center text-slate-500 italic">
                {hasActiveFilters ? 'No tickets match your filters.' : 'No tickets found.'}
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((ticket) => {
              const slaStatus = getCombinedSLAStatus(
                ticket.created_at,
                ticket.first_response_due_at ?? null,
                ticket.first_response_at,
                ticket.sla_due_at,
                ticket.resolved_at,
                ticket.status
              )
              return (
                <TableRow
                  key={ticket.id}
                  onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/dashboard/tickets/${ticket.id}`)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className={cn('transition-colors cursor-pointer', getSLARowColor(slaStatus.status))}
                >
                  <TableCell className="font-mono text-xs text-slate-500 uppercase">
                    #{ticket.ticket_number}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="hover:text-primary transition-colors block">
                      {ticket.subject}
                      {ticket.organization?.is_priority_client && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                                <AlertCircle className="h-3 w-3" />
                                PRIORITY
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Priority client - 50% faster SLA response times</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </span>
                  </TableCell>
                  {showOrgColumn && (
                    <TableCell className="text-sm text-slate-600">
                      {ticket.organization?.name || '—'}
                    </TableCell>
                  )}
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell>
                    <SLAStatusBadge slaStatus={slaStatus} />
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
  )
}

function SLAStatusBadge({ slaStatus }: { slaStatus: ReturnType<typeof getCombinedSLAStatus> }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs font-medium py-0.5 cursor-help',
              slaStatus.colors.bg,
              slaStatus.colors.text,
              slaStatus.colors.border
            )}
          >
            {slaStatus.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{slaStatus.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function formatDate(date: string) {
  try {
    const dateObj = new Date(date)
    // Format with time in user's local timezone
    // Using toLocaleString for automatic timezone handling with fallback to main timezone
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    })
    const formattedTime = dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    })
    return `${formattedDate}, ${formattedTime}`
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
