'use client'

import { useState, useMemo } from 'react'
import { TicketCard } from './ticket-card'
import { TicketFilters } from './ticket-filters'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  Inbox,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 
  TicketWithRelations, 
  TicketFilters as TFilters,
  TicketSort,
  TicketPriority,
  TicketStatus,
} from '@/types/tickets'

interface TicketListProps {
  tickets: TicketWithRelations[]
  isLoading?: boolean
  showOrganization?: boolean
  onTicketClick?: (ticket: TicketWithRelations) => void
  onCreateClick?: () => void
  className?: string
}

export function TicketList({
  tickets,
  isLoading = false,
  showOrganization = false,
  onTicketClick,
  onCreateClick,
  className,
}: TicketListProps) {
  const [filters, setFilters] = useState<TFilters>({})
  const [sort, setSort] = useState<TicketSort>({
    field: 'created_at',
    direction: 'desc',
  })

  // Apply filters and sorting client-side for now
  // In production, this would be done server-side
  const filteredTickets = useMemo(() => {
    let result = [...tickets]

    // Filter by status
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      result = result.filter(t => statuses.includes(t.status))
    }

    // Filter by priority
    if (filters.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority]
      result = result.filter(t => priorities.includes(t.priority))
    }

    // Filter by search
    if (filters.search) {
      const search = filters.search.toLowerCase()
      result = result.filter(
        t =>
          t.subject.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.ticket_number.toLowerCase().includes(search)
      )
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      
      switch (sort.field) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          break
        case 'priority':
          const priorityOrder: Record<TicketPriority, number> = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1,
          }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'status':
          const statusOrder: Record<TicketStatus, number> = {
            new: 1,
            open: 2,
            in_progress: 3,
            pending_client: 4,
            resolved: 5,
            closed: 6,
          }
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        case 'queue_position':
          comparison = (a.queue_position || 999) - (b.queue_position || 999)
          break
      }

      return sort.direction === 'asc' ? comparison : -comparison
    })

    return result
  }, [tickets, filters, sort])

  // Stats for filter summary
  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).length,
    pending: tickets.filter(t => t.status === 'pending_client').length,
    resolved: tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length,
  }), [tickets])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-slate-500">Loading tickets...</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <TicketFilters
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        stats={stats}
      />

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Showing {filteredTickets.length} of {tickets.length} tickets
        </span>
        {onCreateClick && (
          <Button onClick={onCreateClick} size="sm" className="md:hidden">
            <Plus size={16} className="mr-1" />
            New
          </Button>
        )}
      </div>

      {/* Ticket list */}
      {filteredTickets.length === 0 ? (
        <EmptyState 
          hasFilters={Object.keys(filters).length > 0}
          onClearFilters={() => setFilters({})}
          onCreateClick={onCreateClick}
        />
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              showOrganization={showOrganization}
              onClick={() => onTicketClick?.(ticket)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Empty state component
function EmptyState({ 
  hasFilters, 
  onClearFilters,
  onCreateClick,
}: { 
  hasFilters: boolean
  onClearFilters: () => void
  onCreateClick?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Inbox className="h-6 w-6 text-slate-400" />
      </div>
      
      {hasFilters ? (
        <>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No tickets match your filters</h3>
          <p className="text-slate-500 text-center mb-4">
            Try adjusting your search or filter criteria
          </p>
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No tickets yet</h3>
          <p className="text-slate-500 text-center mb-4">
            Create your first support ticket to get started
          </p>
          {onCreateClick && (
            <Button onClick={onCreateClick}>
              <Plus size={16} className="mr-2" />
              Create Ticket
            </Button>
          )}
        </>
      )}
    </div>
  )
}
