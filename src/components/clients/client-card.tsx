'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Building2,
  Users,
  Ticket,
  FileText,
  ChevronRight,
  Globe,
} from 'lucide-react'
import { cn, formatDistanceToNow } from '@/lib/utils'
import { 
  ORGANIZATION_STATUS_CONFIG, 
  ORGANIZATION_TYPE_CONFIG,
} from '@/types/organizations'
import type { OrganizationWithRelations } from '@/types/organizations'

interface ClientCardProps {
  client: OrganizationWithRelations
  onClick?: () => void
  className?: string
}

export function ClientCard({ 
  client, 
  onClick,
  className,
}: ClientCardProps) {
  const statusConfig = ORGANIZATION_STATUS_CONFIG[client.status]
  const typeConfig = ORGANIZATION_TYPE_CONFIG[client.type]

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-slate-300',
        'active:scale-[0.99] active:bg-slate-50',
        client.status === 'suspended' && 'opacity-60',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 md:p-5">
        {/* Top row: Name + Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="text-primary" size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">
                {client.name}
              </h3>
              <p className="text-sm text-slate-500 truncate">
                {client.slug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={cn(typeConfig.bgColor, typeConfig.color, 'border-0 text-xs')}>
              {typeConfig.label}
            </Badge>
            <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'border-0 text-xs')}>
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
          {client.members_count !== undefined && (
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span>{client.members_count} members</span>
            </div>
          )}
          {client.active_tickets_count !== undefined && (
            <div className="flex items-center gap-1">
              <Ticket size={14} />
              <span>{client.active_tickets_count} tickets</span>
            </div>
          )}
          {client.pending_invoices_count !== undefined && (
            <div className="flex items-center gap-1">
              <FileText size={14} />
              <span>{client.pending_invoices_count} invoices</span>
            </div>
          )}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            {client.custom_domain && (
              <div className="flex items-center gap-1">
                <Globe size={12} />
                <span className="truncate max-w-[150px]">{client.custom_domain}</span>
              </div>
            )}
            <span>Added {formatDistanceToNow(client.created_at)}</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for partner dashboard
export function ClientCardCompact({ 
  client, 
  onClick,
  className,
}: ClientCardProps) {
  const statusConfig = ORGANIZATION_STATUS_CONFIG[client.status]

  return (
    <div 
      className={cn(
        'p-3 rounded-lg border border-slate-200 cursor-pointer',
        'hover:bg-slate-50 hover:border-slate-300 transition-colors',
        client.status === 'suspended' && 'opacity-60',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <Building2 className="text-primary" size={12} />
          </div>
          <span className="font-medium text-sm text-slate-900 truncate">
            {client.name}
          </span>
        </div>
        <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'text-[10px] px-1.5 py-0 border-0')}>
          {statusConfig.label}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500 ml-8">
        {client.active_tickets_count !== undefined && (
          <span>{client.active_tickets_count} tickets</span>
        )}
        {client.members_count !== undefined && (
          <span>{client.members_count} members</span>
        )}
      </div>
    </div>
  )
}
