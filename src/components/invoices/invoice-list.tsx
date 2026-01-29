'use client'

import { useState, useMemo } from 'react'
import { InvoiceCard } from './invoice-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Plus,
  Loader2,
  FileText,
  Filter,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCents, INVOICE_STATUS_CONFIG } from '@/types/invoices'
import type { 
  InvoiceWithRelations, 
  InvoiceStatus,
  InvoiceFilters as TFilters,
} from '@/types/invoices'

interface InvoiceListProps {
  invoices: InvoiceWithRelations[]
  isLoading?: boolean
  onInvoiceClick?: (invoice: InvoiceWithRelations) => void
  onCreateClick?: () => void
  className?: string
}

export function InvoiceList({
  invoices,
  isLoading = false,
  onInvoiceClick,
  onCreateClick,
  className,
}: InvoiceListProps) {
  const [filters, setFilters] = useState<TFilters>({})
  const [searchValue, setSearchValue] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Calculate stats
  const stats = useMemo(() => {
    const draft = invoices.filter(i => i.status === 'draft')
    const outstanding = invoices.filter(i => ['sent', 'viewed', 'partial'].includes(i.status))
    const overdue = invoices.filter(i => 
      i.status === 'overdue' || 
      (['sent', 'viewed', 'partial'].includes(i.status) && new Date(i.due_date) < new Date())
    )
    const paid = invoices.filter(i => i.status === 'paid')

    return {
      draft: { count: draft.length, total: draft.reduce((s, i) => s + i.total_cents, 0) },
      outstanding: { count: outstanding.length, total: outstanding.reduce((s, i) => s + (i.total_cents - i.amount_paid_cents), 0) },
      overdue: { count: overdue.length, total: overdue.reduce((s, i) => s + (i.total_cents - i.amount_paid_cents), 0) },
      paid: { count: paid.length, total: paid.reduce((s, i) => s + i.total_cents, 0) },
    }
  }, [invoices])

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    let result = [...invoices]

    // Filter by status
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      result = result.filter(i => statuses.includes(i.status))
    }

    // Filter by overdue
    if (filters.overdue_only) {
      result = result.filter(i => 
        i.status === 'overdue' || 
        (['sent', 'viewed', 'partial'].includes(i.status) && new Date(i.due_date) < new Date())
      )
    }

    // Filter by search
    if (searchValue) {
      const search = searchValue.toLowerCase()
      result = result.filter(i =>
        i.invoice_number.toLowerCase().includes(search) ||
        i.client_organization?.name?.toLowerCase().includes(search)
      )
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return result
  }, [invoices, filters, searchValue])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const toggleStatus = (status: InvoiceStatus) => {
    const current = Array.isArray(filters.status) 
      ? filters.status 
      : filters.status 
        ? [filters.status] 
        : []
    
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
    
    setFilters({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    })
  }

  const isStatusSelected = (status: InvoiceStatus) => {
    if (!filters.status) return false
    return Array.isArray(filters.status) 
      ? filters.status.includes(status)
      : filters.status === status
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-slate-500">Loading invoices...</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Draft"
          count={stats.draft.count}
          amount={formatCents(stats.draft.total)}
          active={isStatusSelected('draft')}
          onClick={() => toggleStatus('draft')}
        />
        <StatCard
          label="Outstanding"
          count={stats.outstanding.count}
          amount={formatCents(stats.outstanding.total)}
          active={filters.status && ['sent', 'viewed', 'partial'].some(s => isStatusSelected(s as InvoiceStatus))}
          onClick={() => setFilters({ ...filters, status: ['sent', 'viewed', 'partial'] })}
          variant="blue"
        />
        <StatCard
          label="Overdue"
          count={stats.overdue.count}
          amount={formatCents(stats.overdue.total)}
          active={filters.overdue_only || isStatusSelected('overdue')}
          onClick={() => setFilters({ ...filters, overdue_only: !filters.overdue_only, status: undefined })}
          variant="red"
        />
        <StatCard
          label="Paid"
          count={stats.paid.count}
          amount={formatCents(stats.paid.total)}
          active={isStatusSelected('paid')}
          onClick={() => toggleStatus('paid')}
          variant="green"
        />
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" 
          />
          <Input
            type="search"
            placeholder="Search invoices..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10"
          />
        </form>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && 'bg-slate-100')}
        >
          <Filter size={18} />
        </Button>

        {onCreateClick && (
          <Button onClick={onCreateClick} className="hidden md:flex gap-2">
            <Plus size={18} />
            New Invoice
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
          <p className="text-sm font-medium text-slate-700">Filter by status</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(INVOICE_STATUS_CONFIG) as InvoiceStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors',
                  isStatusSelected(status)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                {isStatusSelected(status) && <Check size={14} />}
                {INVOICE_STATUS_CONFIG[status].label}
              </button>
            ))}
          </div>
          
          {(filters.status || filters.overdue_only) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({})}
              className="text-slate-500"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Showing {filteredInvoices.length} of {invoices.length} invoices
        </span>
        {onCreateClick && (
          <Button onClick={onCreateClick} size="sm" className="md:hidden">
            <Plus size={16} className="mr-1" />
            New
          </Button>
        )}
      </div>

      {/* Invoice list */}
      {filteredInvoices.length === 0 ? (
        <EmptyState 
          hasFilters={!!filters.status || !!filters.overdue_only || !!searchValue}
          onClearFilters={() => { setFilters({}); setSearchValue(''); }}
          onCreateClick={onCreateClick}
        />
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onClick={() => onInvoiceClick?.(invoice)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Stat card component
function StatCard({
  label,
  count,
  amount,
  active,
  onClick,
  variant = 'default',
}: {
  label: string
  count: number
  amount: string
  active?: boolean
  onClick: () => void
  variant?: 'default' | 'blue' | 'red' | 'green'
}) {
  const variantStyles = {
    default: 'border-slate-200 hover:border-slate-300',
    blue: 'border-blue-200 hover:border-blue-300',
    red: 'border-red-200 hover:border-red-300',
    green: 'border-green-200 hover:border-green-300',
  }

  const activeStyles = {
    default: 'bg-slate-100 border-slate-400',
    blue: 'bg-blue-50 border-blue-400',
    red: 'bg-red-50 border-red-400',
    green: 'bg-green-50 border-green-400',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-3 rounded-lg border text-left transition-colors',
        active ? activeStyles[variant] : variantStyles[variant],
        'bg-white hover:bg-slate-50'
      )}
    >
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{count}</p>
      <p className="text-xs text-slate-500">{amount}</p>
    </button>
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
        <FileText className="h-6 w-6 text-slate-400" />
      </div>
      
      {hasFilters ? (
        <>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No invoices match your filters</h3>
          <p className="text-slate-500 text-center mb-4">
            Try adjusting your search or filter criteria
          </p>
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No invoices yet</h3>
          <p className="text-slate-500 text-center mb-4">
            Create your first invoice to get started
          </p>
          {onCreateClick && (
            <Button onClick={onCreateClick}>
              <Plus size={16} className="mr-2" />
              Create Invoice
            </Button>
          )}
        </>
      )}
    </div>
  )
}
