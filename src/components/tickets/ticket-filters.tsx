'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 
  TicketFilters as TFilters,
  TicketSort,
  TicketPriority,
  TicketStatus,
} from '@/types/tickets'

interface TicketFiltersProps {
  filters: TFilters
  onFiltersChange: (filters: TFilters) => void
  sort: TicketSort
  onSortChange: (sort: TicketSort) => void
  stats: {
    total: number
    open: number
    pending: number
    resolved: number
  }
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_client', label: 'Pending Client' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const SORT_OPTIONS: { value: TicketSort['field']; label: string }[] = [
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'priority', label: 'Priority' },
  { value: 'queue_position', label: 'Queue Position' },
]

export function TicketFilters({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  stats,
}: TicketFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [searchValue, setSearchValue] = useState(filters.search || '')

  const activeFilterCount = [
    filters.status,
    filters.priority,
    filters.search,
  ].filter(Boolean).length

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFiltersChange({ ...filters, search: searchValue || undefined })
  }

  const toggleStatus = (status: TicketStatus) => {
    const current = Array.isArray(filters.status) 
      ? filters.status 
      : filters.status 
        ? [filters.status] 
        : []
    
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
    
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    })
  }

  const togglePriority = (priority: TicketPriority) => {
    const current = Array.isArray(filters.priority) 
      ? filters.priority 
      : filters.priority 
        ? [filters.priority] 
        : []
    
    const updated = current.includes(priority)
      ? current.filter(p => p !== priority)
      : [...current, priority]
    
    onFiltersChange({
      ...filters,
      priority: updated.length > 0 ? updated : undefined,
    })
  }

  const clearFilters = () => {
    onFiltersChange({})
    setSearchValue('')
  }

  const isStatusSelected = (status: TicketStatus) => {
    if (!filters.status) return false
    return Array.isArray(filters.status) 
      ? filters.status.includes(status)
      : filters.status === status
  }

  const isPrioritySelected = (priority: TicketPriority) => {
    if (!filters.priority) return false
    return Array.isArray(filters.priority) 
      ? filters.priority.includes(priority)
      : filters.priority === priority
  }

  return (
    <div className="space-y-3">
      {/* Quick stats */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        <QuickFilter
          label="All"
          count={stats.total}
          active={!filters.status}
          onClick={() => onFiltersChange({ ...filters, status: undefined })}
        />
        <QuickFilter
          label="Open"
          count={stats.open}
          active={isStatusSelected('open') || isStatusSelected('new') || isStatusSelected('in_progress')}
          onClick={() => onFiltersChange({ 
            ...filters, 
            status: ['new', 'open', 'in_progress'] 
          })}
        />
        <QuickFilter
          label="Pending"
          count={stats.pending}
          active={isStatusSelected('pending_client')}
          onClick={() => toggleStatus('pending_client')}
        />
        <QuickFilter
          label="Resolved"
          count={stats.resolved}
          active={isStatusSelected('resolved') || isStatusSelected('closed')}
          onClick={() => onFiltersChange({ 
            ...filters, 
            status: ['resolved', 'closed'] 
          })}
        />
      </div>

      {/* Search and filter toggle */}
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" 
          />
          <Input
            type="search"
            placeholder="Search tickets..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 pr-4"
          />
        </form>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'relative shrink-0',
            showFilters && 'bg-slate-100'
          )}
        >
          <SlidersHorizontal size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* Sort dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 hidden md:flex"
            onClick={() => {
              onSortChange({
                ...sort,
                direction: sort.direction === 'asc' ? 'desc' : 'asc',
              })
            }}
          >
            <ArrowUpDown size={14} />
            <span className="hidden lg:inline">
              {SORT_OPTIONS.find(o => o.value === sort.field)?.label}
            </span>
          </Button>
        </div>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="p-4 border rounded-lg bg-slate-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Status filters */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  selected={isStatusSelected(option.value)}
                  onClick={() => toggleStatus(option.value)}
                />
              ))}
            </div>
          </div>

          {/* Priority filters */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  selected={isPrioritySelected(option.value)}
                  onClick={() => togglePriority(option.value)}
                  variant={option.value}
                />
              ))}
            </div>
          </div>

          {/* Sort options - mobile */}
          <div className="md:hidden">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Sort by
            </label>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  selected={sort.field === option.value}
                  onClick={() => onSortChange({ ...sort, field: option.value })}
                />
              ))}
            </div>
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-slate-500"
            >
              <X size={14} className="mr-1" />
              Clear all filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Quick filter button component
function QuickFilter({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
        active
          ? 'bg-primary text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {label}
      <span
        className={cn(
          'text-xs px-1.5 py-0.5 rounded-full',
          active ? 'bg-white/20' : 'bg-slate-200'
        )}
      >
        {count}
      </span>
    </button>
  )
}

// Filter chip component
function FilterChip({
  label,
  selected,
  onClick,
  variant,
}: {
  label: string
  selected: boolean
  onClick: () => void
  variant?: TicketPriority
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      )}
    >
      {selected && <Check size={14} />}
      {label}
    </button>
  )
}
