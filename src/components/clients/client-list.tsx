'use client'

import { useState, useMemo } from 'react'
import { ClientCard } from './client-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search,
  Plus,
  Loader2,
  Building2,
  Filter,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  ORGANIZATION_STATUS_CONFIG,
  ORGANIZATION_TYPE_CONFIG,
} from '@/types/organizations'
import type { 
  OrganizationWithRelations, 
  OrganizationStatus,
  OrganizationType,
  OrganizationFilters as TFilters,
} from '@/types/organizations'

interface ClientListProps {
  clients: OrganizationWithRelations[]
  isLoading?: boolean
  onClientClick?: (client: OrganizationWithRelations) => void
  onCreateClick?: () => void
  showTypeFilter?: boolean
  className?: string
}

export function ClientList({
  clients,
  isLoading = false,
  onClientClick,
  onCreateClick,
  showTypeFilter = false,
  className,
}: ClientListProps) {
  const [filters, setFilters] = useState<TFilters>({})
  const [searchValue, setSearchValue] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Calculate stats
  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    inactive: clients.filter(c => c.status === 'inactive').length,
    suspended: clients.filter(c => c.status === 'suspended').length,
    partners: clients.filter(c => c.type === 'partner').length,
    directClients: clients.filter(c => c.type === 'client').length,
  }), [clients])

  // Filter clients
  const filteredClients = useMemo(() => {
    let result = [...clients]

    // Filter by status
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      result = result.filter(c => statuses.includes(c.status))
    }

    // Filter by type
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type]
      result = result.filter(c => types.includes(c.type))
    }

    // Filter by search
    if (searchValue) {
      const search = searchValue.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.slug.toLowerCase().includes(search) ||
        c.custom_domain?.toLowerCase().includes(search)
      )
    }

    // Sort alphabetically
    result.sort((a, b) => a.name.localeCompare(b.name))

    return result
  }, [clients, filters, searchValue])

  const toggleStatus = (status: OrganizationStatus) => {
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

  const toggleType = (type: OrganizationType) => {
    const current = Array.isArray(filters.type) 
      ? filters.type 
      : filters.type 
        ? [filters.type] 
        : []
    
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    
    setFilters({
      ...filters,
      type: updated.length > 0 ? updated : undefined,
    })
  }

  const isStatusSelected = (status: OrganizationStatus) => {
    if (!filters.status) return false
    return Array.isArray(filters.status) 
      ? filters.status.includes(status)
      : filters.status === status
  }

  const isTypeSelected = (type: OrganizationType) => {
    if (!filters.type) return false
    return Array.isArray(filters.type) 
      ? filters.type.includes(type)
      : filters.type === type
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-slate-500">Loading clients...</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total"
          count={stats.total}
          active={!filters.status && !filters.type}
          onClick={() => setFilters({})}
        />
        <StatCard
          label="Active"
          count={stats.active}
          active={isStatusSelected('active')}
          onClick={() => toggleStatus('active')}
          variant="green"
        />
        {showTypeFilter && (
          <>
            <StatCard
              label="Partners"
              count={stats.partners}
              active={isTypeSelected('partner')}
              onClick={() => toggleType('partner')}
              variant="blue"
            />
            <StatCard
              label="Direct Clients"
              count={stats.directClients}
              active={isTypeSelected('client')}
              onClick={() => toggleType('client')}
            />
          </>
        )}
        {!showTypeFilter && (
          <>
            <StatCard
              label="Inactive"
              count={stats.inactive}
              active={isStatusSelected('inactive')}
              onClick={() => toggleStatus('inactive')}
            />
            <StatCard
              label="Suspended"
              count={stats.suspended}
              active={isStatusSelected('suspended')}
              onClick={() => toggleStatus('suspended')}
              variant="red"
            />
          </>
        )}
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" 
          />
          <Input
            type="search"
            placeholder="Search clients..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10"
          />
        </div>
        
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
            Add Client
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ORGANIZATION_STATUS_CONFIG) as OrganizationStatus[]).map((status) => (
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
                  {ORGANIZATION_STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
          </div>

          {showTypeFilter && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Type</p>
              <div className="flex flex-wrap gap-2">
                {(['partner', 'client'] as OrganizationType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors',
                      isTypeSelected(type)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    )}
                  >
                    {isTypeSelected(type) && <Check size={14} />}
                    {ORGANIZATION_TYPE_CONFIG[type].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {(filters.status || filters.type) && (
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
          Showing {filteredClients.length} of {clients.length} clients
        </span>
        {onCreateClick && (
          <Button onClick={onCreateClick} size="sm" className="md:hidden">
            <Plus size={16} className="mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Client list */}
      {filteredClients.length === 0 ? (
        <EmptyState 
          hasFilters={!!filters.status || !!filters.type || !!searchValue}
          onClearFilters={() => { setFilters({}); setSearchValue(''); }}
          onCreateClick={onCreateClick}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => onClientClick?.(client)}
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
  active,
  onClick,
  variant = 'default',
}: {
  label: string
  count: number
  active?: boolean
  onClick: () => void
  variant?: 'default' | 'green' | 'blue' | 'red'
}) {
  const variantStyles = {
    default: 'border-slate-200 hover:border-slate-300',
    green: 'border-green-200 hover:border-green-300',
    blue: 'border-blue-200 hover:border-blue-300',
    red: 'border-red-200 hover:border-red-300',
  }

  const activeStyles = {
    default: 'bg-slate-100 border-slate-400',
    green: 'bg-green-50 border-green-400',
    blue: 'bg-blue-50 border-blue-400',
    red: 'bg-red-50 border-red-400',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-3 rounded-lg border text-left transition-colors bg-white hover:bg-slate-50',
        active ? activeStyles[variant] : variantStyles[variant]
      )}
    >
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{count}</p>
    </button>
  )
}

// Empty state
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
        <Building2 className="h-6 w-6 text-slate-400" />
      </div>
      
      {hasFilters ? (
        <>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No clients match your filters</h3>
          <p className="text-slate-500 text-center mb-4">
            Try adjusting your search or filter criteria
          </p>
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No clients yet</h3>
          <p className="text-slate-500 text-center mb-4">
            Add your first client to get started
          </p>
          {onCreateClick && (
            <Button onClick={onCreateClick}>
              <Plus size={16} className="mr-2" />
              Add Client
            </Button>
          )}
        </>
      )}
    </div>
  )
}
