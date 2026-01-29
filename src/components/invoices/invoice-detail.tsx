'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  Download,
  Mail,
  MoreHorizontal,
  Printer,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  XCircle,
  Edit,
  Trash2,
  Copy,
} from 'lucide-react'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { 
  formatCents, 
  INVOICE_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
} from '@/types/invoices'
import type { 
  InvoiceWithRelations, 
  InvoiceStatus,
  Payment,
} from '@/types/invoices'

interface InvoiceDetailProps {
  invoice: InvoiceWithRelations
  onBack?: () => void
  onSend?: () => void
  onMarkPaid?: () => void
  onVoid?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onDownloadPdf?: () => void
  isStaff?: boolean
  className?: string
}

export function InvoiceDetail({
  invoice,
  onBack,
  onSend,
  onMarkPaid,
  onVoid,
  onEdit,
  onDelete,
  onDuplicate,
  onDownloadPdf,
  isStaff = false,
  className,
}: InvoiceDetailProps) {
  const [showActions, setShowActions] = useState(false)

  const clientName = invoice.client_organization?.name || 'Unknown Client'
  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status]
  const amountDue = invoice.total_cents - invoice.amount_paid_cents
  const isOverdue = invoice.status !== 'paid' && 
    invoice.status !== 'void' && 
    invoice.status !== 'cancelled' &&
    new Date(invoice.due_date) < new Date()

  const canSend = invoice.status === 'draft'
  const canMarkPaid = ['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status)
  const canVoid = ['draft', 'sent', 'viewed', 'overdue'].includes(invoice.status)
  const canEdit = invoice.status === 'draft'

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0 mt-1"
            >
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-slate-500">
                {invoice.invoice_number}
              </span>
              <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'border-0')}>
                {statusConfig.label}
              </Badge>
              {isOverdue && invoice.status !== 'overdue' && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle size={12} />
                  Overdue
                </Badge>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              {formatCents(invoice.total_cents, invoice.currency)}
            </h1>
            <p className="text-slate-500 mt-1">
              {clientName}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {canSend && onSend && (
            <Button onClick={onSend} className="gap-2">
              <Send size={16} />
              <span className="hidden sm:inline">Send Invoice</span>
            </Button>
          )}
          
          {canMarkPaid && onMarkPaid && (
            <Button onClick={onMarkPaid} variant="outline" className="gap-2">
              <CheckCircle size={16} />
              <span className="hidden sm:inline">Mark Paid</span>
            </Button>
          )}

          {onDownloadPdf && (
            <Button variant="outline" size="icon" onClick={onDownloadPdf}>
              <Download size={18} />
            </Button>
          )}

          {isStaff && (
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreHorizontal size={18} />
              </Button>
              
              {showActions && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border rounded-lg shadow-lg py-1 z-10">
                  {canEdit && onEdit && (
                    <button
                      onClick={() => { onEdit(); setShowActions(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit size={16} />
                      Edit Invoice
                    </button>
                  )}
                  {onDuplicate && (
                    <button
                      onClick={() => { onDuplicate(); setShowActions(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Copy size={16} />
                      Duplicate
                    </button>
                  )}
                  <button
                    onClick={() => { window.print(); setShowActions(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  {canVoid && onVoid && (
                    <>
                      <div className="border-t my-1" />
                      <button
                        onClick={() => { onVoid(); setShowActions(false); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-orange-600 flex items-center gap-2"
                      >
                        <XCircle size={16} />
                        Void Invoice
                      </button>
                    </>
                  )}
                  {invoice.status === 'draft' && onDelete && (
                    <button
                      onClick={() => { onDelete(); setShowActions(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Amount due banner */}
      {amountDue > 0 && invoice.status !== 'void' && invoice.status !== 'cancelled' && (
        <div className={cn(
          'rounded-lg p-4 flex items-center justify-between',
          isOverdue ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center',
              isOverdue ? 'bg-red-100' : 'bg-blue-100'
            )}>
              <DollarSign className={isOverdue ? 'text-red-600' : 'text-blue-600'} size={20} />
            </div>
            <div>
              <p className={cn('font-medium', isOverdue ? 'text-red-700' : 'text-blue-700')}>
                Amount Due
              </p>
              <p className={cn('text-2xl font-bold', isOverdue ? 'text-red-600' : 'text-blue-600')}>
                {formatCents(amountDue, invoice.currency)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Due Date</p>
            <p className={cn('font-medium', isOverdue ? 'text-red-600' : 'text-slate-700')}>
              {formatDate(invoice.due_date)}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-slate-500">
                      <th className="pb-3 font-medium">Description</th>
                      <th className="pb-3 font-medium text-right w-20">Qty</th>
                      <th className="pb-3 font-medium text-right w-28">Rate</th>
                      <th className="pb-3 font-medium text-right w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.line_items.map((item, index) => (
                      <tr key={item.id || index} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-900">{item.description}</p>
                        </td>
                        <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                        <td className="py-3 text-right text-slate-600">
                          {formatCents(item.unit_price_cents, invoice.currency)}
                        </td>
                        <td className="py-3 text-right font-medium text-slate-900">
                          {formatCents(item.amount_cents, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900">{formatCents(invoice.subtotal_cents, invoice.currency)}</span>
                </div>
                
                {invoice.discount_amount_cents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      Discount
                      {invoice.discount_type === 'percentage' && ` (${invoice.discount_value / 100}%)`}
                    </span>
                    <span className="text-green-600">
                      -{formatCents(invoice.discount_amount_cents, invoice.currency)}
                    </span>
                  </div>
                )}
                
                {invoice.tax_amount_cents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      Tax ({(invoice.tax_rate / 100).toFixed(2)}%)
                    </span>
                    <span className="text-slate-900">
                      {formatCents(invoice.tax_amount_cents, invoice.currency)}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCents(invoice.total_cents, invoice.currency)}</span>
                </div>

                {invoice.amount_paid_cents > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Paid</span>
                      <span>-{formatCents(invoice.amount_paid_cents, invoice.currency)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Balance Due</span>
                      <span className={amountDue > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCents(amountDue, invoice.currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {(invoice.notes || invoice.terms) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice.notes && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Notes</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Terms</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{invoice.terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payments */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard size={18} />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoice.payments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} currency={invoice.currency} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Bill To</p>
                  <p className="font-medium">{clientName}</p>
                </div>
              </div>

              {invoice.issue_date && (
                <div className="flex items-start gap-3">
                  <Calendar size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Issue Date</p>
                    <p className="font-medium">{formatDate(invoice.issue_date)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Clock size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Due Date</p>
                  <p className={cn('font-medium', isOverdue && 'text-red-600')}>
                    {formatDate(invoice.due_date)}
                  </p>
                </div>
              </div>

              {invoice.sent_at && (
                <div className="flex items-start gap-3">
                  <Mail size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Sent</p>
                    <p className="font-medium">{formatDateTime(invoice.sent_at)}</p>
                  </div>
                </div>
              )}

              {invoice.viewed_at && (
                <div className="flex items-start gap-3">
                  <FileText size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Viewed</p>
                    <p className="font-medium">{formatDateTime(invoice.viewed_at)}</p>
                  </div>
                </div>
              )}

              {invoice.paid_at && (
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Paid</p>
                    <p className="font-medium text-green-600">{formatDateTime(invoice.paid_at)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recurring info */}
          {invoice.is_recurring && invoice.recurring_config && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recurring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Frequency</span>
                    <span className="font-medium capitalize">{invoice.recurring_config.frequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Next Invoice</span>
                    <span className="font-medium">{formatDate(invoice.recurring_config.next_date)}</span>
                  </div>
                  {invoice.recurring_config.end_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ends</span>
                      <span className="font-medium">{formatDate(invoice.recurring_config.end_date)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// Payment row component
function PaymentRow({ payment, currency }: { payment: Payment; currency: string }) {
  const statusConfig = PAYMENT_STATUS_CONFIG[payment.status]
  
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
          <CreditCard size={16} className="text-green-600" />
        </div>
        <div>
          <p className="font-medium text-slate-900">
            {formatCents(payment.amount_cents, currency)}
          </p>
          <p className="text-xs text-slate-500">
            {payment.method.replace('_', ' ')} 
            {payment.paid_at && ` • ${formatDate(payment.paid_at)}`}
          </p>
        </div>
      </div>
      <Badge className={cn('bg-green-100 text-green-700 border-0')}>
        {statusConfig.label}
      </Badge>
    </div>
  )
}
