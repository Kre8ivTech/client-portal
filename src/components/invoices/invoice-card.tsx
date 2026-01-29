'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar,
  Building2,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { cn, formatDate, formatDistanceToNow } from '@/lib/utils'
import { formatCents, INVOICE_STATUS_CONFIG } from '@/types/invoices'
import type { InvoiceWithRelations, InvoiceStatus } from '@/types/invoices'

interface InvoiceCardProps {
  invoice: InvoiceWithRelations
  onClick?: () => void
  className?: string
}

// Badge variants for invoice status
const statusVariants: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'default',
  viewed: 'default',
  partial: 'outline',
  paid: 'default',
  overdue: 'destructive',
  void: 'secondary',
  cancelled: 'secondary',
}

export function InvoiceCard({ 
  invoice, 
  onClick,
  className,
}: InvoiceCardProps) {
  const clientName = invoice.client_organization?.name || 'Unknown Client'
  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status]
  const isOverdue = invoice.status === 'overdue' || (
    invoice.status !== 'paid' && 
    invoice.status !== 'void' && 
    invoice.status !== 'cancelled' &&
    new Date(invoice.due_date) < new Date()
  )
  const amountDue = invoice.total_cents - invoice.amount_paid_cents
  
  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-slate-300',
        'active:scale-[0.99] active:bg-slate-50',
        isOverdue && 'border-red-200 bg-red-50/30',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 md:p-5">
        {/* Top row: Invoice number + Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono font-medium text-slate-700">
              {invoice.invoice_number}
            </span>
            {isOverdue && invoice.status !== 'overdue' && (
              <AlertTriangle size={16} className="text-red-500" />
            )}
          </div>
          <Badge 
            className={cn(statusConfig.bgColor, statusConfig.color, 'border-0')}
          >
            {statusConfig.label}
          </Badge>
        </div>

        {/* Client name */}
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={16} className="text-slate-400" />
          <span className="font-medium text-slate-900 truncate">
            {clientName}
          </span>
        </div>

        {/* Amounts */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Total</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatCents(invoice.total_cents, invoice.currency)}
            </p>
          </div>
          
          {invoice.amount_paid_cents > 0 && invoice.status !== 'paid' && (
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-0.5">Amount Due</p>
              <p className={cn(
                'text-lg font-semibold',
                isOverdue ? 'text-red-600' : 'text-slate-700'
              )}>
                {formatCents(amountDue, invoice.currency)}
              </p>
            </div>
          )}
          
          {invoice.status === 'paid' && (
            <div className="text-right">
              <p className="text-xs text-green-600 font-medium">Paid in full</p>
            </div>
          )}
        </div>

        {/* Bottom row: Due date */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1">
            <Calendar size={14} />
            <span>
              {invoice.status === 'paid' 
                ? `Paid ${invoice.paid_at ? formatDistanceToNow(invoice.paid_at) : ''}`
                : invoice.status === 'draft'
                  ? 'Draft'
                  : isOverdue
                    ? `Due ${formatDistanceToNow(invoice.due_date)} (overdue)`
                    : `Due ${formatDate(invoice.due_date)}`
              }
            </span>
          </div>
          <ChevronRight size={18} className="text-slate-300" />
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for widgets/sidebars
export function InvoiceCardCompact({ 
  invoice, 
  onClick,
  className,
}: InvoiceCardProps) {
  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status]
  const isOverdue = invoice.status !== 'paid' && new Date(invoice.due_date) < new Date()

  return (
    <div 
      className={cn(
        'p-3 rounded-lg border border-slate-200 cursor-pointer',
        'hover:bg-slate-50 hover:border-slate-300 transition-colors',
        isOverdue && 'border-red-200 bg-red-50/50',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-slate-500">
          {invoice.invoice_number}
        </span>
        <Badge 
          className={cn(statusConfig.bgColor, statusConfig.color, 'text-[10px] px-1.5 py-0 border-0')}
        >
          {statusConfig.label}
        </Badge>
      </div>
      <p className="font-semibold text-slate-900">
        {formatCents(invoice.total_cents, invoice.currency)}
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {invoice.client_organization?.name || 'Unknown'}
      </p>
    </div>
  )
}
