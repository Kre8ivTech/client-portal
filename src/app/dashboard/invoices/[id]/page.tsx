import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PayInvoiceButton } from '@/components/invoices/PayInvoiceButton'
import { RecordManualPaymentDialog } from '@/components/invoices/record-manual-payment-dialog'
import { SyncToQuickBooksButton } from '@/components/invoices/sync-to-quickbooks-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, ArrowLeft, DollarSign, Calendar, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { generatePageMetadata } from '@/lib/seo'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('invoice_number, status, total, currency')
    .eq('id', id)
    .single()

  if (!invoice) {
    return generatePageMetadata({ title: 'Invoice Not Found' })
  }

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: invoice.currency || 'USD',
  }).format((invoice.total || 0) / 100)

  return generatePageMetadata({
    title: `Invoice ${invoice.invoice_number}`,
    description: `Invoice ${invoice.invoice_number} - ${formattedTotal} - Status: ${invoice.status}`,
    noIndex: true,
  })
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Unauthorized</div>
  }

  // Fetch invoice with line items and payment history
  const { data: invoice, error } = await (supabase as any)
    .from('invoices')
    .select(`
      *,
      organization:organizations(id, name),
      line_items:invoice_line_items(*),
      payments:invoice_payments(
        id,
        amount,
        payment_method,
        payment_date,
        payment_reference,
        payment_source,
        notes,
        created_at,
        recorded_by_profile:profiles!invoice_payments_recorded_by_fkey(
          name,
          email
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !invoice) {
    notFound()
  }

  // Verify user can access this invoice and get their role
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, is_account_manager')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return <div>Profile not found</div>
  }

  const p = profile as { organization_id: string | null; role: string; is_account_manager: boolean }
  if (p.organization_id !== invoice.organization_id) {
    return <div>Access denied</div>
  }

  const isAccountManager = p.role === 'super_admin' || (p.role === 'staff' && p.is_account_manager)

  // Check if QuickBooks is connected
  let quickbooksConnected = false
  if (isAccountManager) {
    const { data: qbIntegration } = await supabase
      .from('quickbooks_integrations')
      .select('id')
      .eq('organization_id', invoice.organization_id)
      .single()
    quickbooksConnected = !!qbIntegration
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700',
      sent: 'bg-blue-100 text-blue-700',
      viewed: 'bg-indigo-100 text-indigo-700',
      partial: 'bg-yellow-100 text-yellow-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
    }
    return colors[status] || 'bg-slate-100 text-slate-700'
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency,
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const canPay = invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.balance_due > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/invoices"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Invoices
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{invoice.invoice_number}</h1>
            <p className="text-muted-foreground mt-1">
              Invoice Details
            </p>
          </div>
          <Badge className={getStatusColor(invoice.status)}>
            {invoice.status}
          </Badge>
        </div>
      </div>

      {/* Invoice Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Summary</CardTitle>
          <CardDescription>
            Issued on {formatDate(invoice.issue_date)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(invoice.due_date)}</p>
            </div>
            {invoice.payment_terms_days && (
              <div>
                <p className="text-sm text-muted-foreground">Payment Terms</p>
                <p className="font-medium">Net {invoice.payment_terms_days} days</p>
              </div>
            )}
          </div>

          {invoice.period_start && invoice.period_end && (
            <div>
              <p className="text-sm text-muted-foreground">Billing Period</p>
              <p className="font-medium">
                {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
              </p>
            </div>
          )}

          {invoice.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium text-right">Qty</th>
                  <th className="pb-3 font-medium text-right">Unit Price</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.line_items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-3">{item.description}</td>
                    <td className="py-3 text-right">{item.quantity}</td>
                    <td className="py-3 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {invoice.tax_rate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({(invoice.tax_rate * 100).toFixed(2)}%)
                  </span>
                  <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
                </div>
              )}

              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Discount {invoice.discount_description && `(${invoice.discount_description})`}
                  </span>
                  <span className="font-medium text-green-600">
                    -{formatCurrency(invoice.discount_amount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>

              {invoice.amount_paid > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-medium text-green-600">
                      -{formatCurrency(invoice.amount_paid)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Balance Due</span>
                    <span className="text-red-600">{formatCurrency(invoice.balance_due)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>
              {invoice.payments.length} payment{invoice.payments.length !== 1 ? 's' : ''} recorded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoice.payments.map((payment: any) => {
                const paymentSourceLabel =
                  payment.payment_source === 'stripe' ? 'Stripe' :
                  payment.payment_source === 'manual' ? 'Manual' :
                  payment.payment_source === 'quickbooks' ? 'QuickBooks' :
                  payment.payment_source;

                const paymentSourceBadge =
                  payment.payment_source === 'stripe' ? 'bg-purple-100 text-purple-700' :
                  payment.payment_source === 'manual' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700';

                return (
                  <div
                    key={payment.id}
                    className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                        <Badge className={paymentSourceBadge}>{paymentSourceLabel}</Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(payment.payment_date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          <span className="capitalize">
                            {payment.payment_method.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {payment.payment_reference && (
                        <p className="text-sm text-muted-foreground">
                          Reference: {payment.payment_reference}
                        </p>
                      )}

                      {payment.notes && (
                        <p className="text-sm text-muted-foreground">
                          Notes: {payment.notes}
                        </p>
                      )}

                      {payment.payment_source === 'manual' && payment.recorded_by_profile && (
                        <p className="text-xs text-muted-foreground">
                          Recorded by {payment.recorded_by_profile.name || payment.recorded_by_profile.email}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4 flex-wrap">
        <Button variant="outline" disabled>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        {canPay && <PayInvoiceButton invoice={invoice} />}
        {isAccountManager && invoice.balance_due > 0 && invoice.status !== 'cancelled' && (
          <RecordManualPaymentDialog
            invoiceId={invoice.id}
            balanceDue={invoice.balance_due}
          />
        )}
        {isAccountManager && quickbooksConnected && (
          <SyncToQuickBooksButton
            invoiceId={invoice.id}
            quickbooksSyncStatus={invoice.quickbooks_sync_status}
            quickbooksInvoiceId={invoice.quickbooks_invoice_id}
            isConnected={quickbooksConnected}
          />
        )}
      </div>
    </div>
  )
}
