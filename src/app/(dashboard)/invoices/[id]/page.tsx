'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { InvoiceDetail } from '@/components/invoices/invoice-detail'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import type { InvoiceWithRelations } from '@/types/invoices'

// Mock invoice data
const MOCK_INVOICE: InvoiceWithRelations = {
  id: '1',
  organization_id: 'org-1',
  client_org_id: 'client-1',
  invoice_number: 'KRE8I-2026-0001',
  line_items: [
    { 
      id: '1', 
      description: 'Website Development - Phase 1\nIncludes homepage, about page, contact page, and blog setup', 
      quantity: 1, 
      unit_price_cents: 500000, 
      amount_cents: 500000 
    },
    { 
      id: '2', 
      description: 'Hosting Setup (Annual)\nAWS hosting with SSL, CDN, and automated backups', 
      quantity: 1, 
      unit_price_cents: 30000, 
      amount_cents: 30000 
    },
    { 
      id: '3', 
      description: 'Domain Registration (1 year)', 
      quantity: 1, 
      unit_price_cents: 1500, 
      amount_cents: 1500 
    },
  ],
  subtotal_cents: 531500,
  tax_rate: 825, // 8.25%
  tax_amount_cents: 43849,
  discount_type: 'percentage',
  discount_value: 500, // 5%
  discount_amount_cents: 26575,
  total_cents: 548774,
  amount_paid_cents: 200000,
  currency: 'USD',
  status: 'partial',
  issue_date: '2026-01-15',
  due_date: '2026-02-14',
  sent_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  viewed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  paid_at: null,
  payment_terms_id: null,
  notes: 'Thank you for choosing Kre8ivTech for your website development needs!\n\nThis invoice covers the first phase of development as outlined in our project agreement.',
  terms: 'Payment is due within 30 days of invoice date. Late payments may incur a 1.5% monthly fee.',
  footer: null,
  is_recurring: false,
  recurring_config: null,
  parent_invoice_id: null,
  project_id: null,
  contract_id: null,
  pdf_url: null,
  pdf_generated_at: null,
  created_by: 'staff-1',
  created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  client_organization: {
    id: 'client-1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
  },
  payments: [
    {
      id: 'p1',
      invoice_id: '1',
      organization_id: 'org-1',
      amount_cents: 200000,
      currency: 'USD',
      method: 'stripe',
      provider: 'stripe',
      transaction_id: 'pi_3abc123xyz',
      provider_fee_cents: 610,
      provider_response: null,
      status: 'completed',
      refund_amount_cents: 0,
      refund_reason: null,
      refunded_at: null,
      reference: 'Deposit payment',
      notes: null,
      paid_by: 'client-user-1',
      paid_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ],
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Simulate fetching invoice data
  useEffect(() => {
    const fetchInvoice = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // In production, this would fetch from Supabase
        setInvoice(MOCK_INVOICE)
      } catch (err) {
        setError('Failed to load invoice')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvoice()
  }, [invoiceId])

  const handleBack = () => {
    router.push('/invoices')
  }

  const handleSend = async () => {
    if (!invoice) return
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setInvoice({
      ...invoice,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    
    alert('Invoice sent successfully!')
  }

  const handleMarkPaid = async () => {
    if (!invoice) return
    
    const remaining = invoice.total_cents - invoice.amount_paid_cents
    if (!confirm(`Mark invoice as paid? This will record a payment of ${(remaining / 100).toFixed(2)} ${invoice.currency}.`)) {
      return
    }
    
    // Simulate marking as paid
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const newPayment = {
      id: `p${Date.now()}`,
      invoice_id: invoice.id,
      organization_id: invoice.organization_id,
      amount_cents: remaining,
      currency: invoice.currency,
      method: 'bank_transfer' as const,
      provider: 'manual',
      transaction_id: null,
      provider_fee_cents: 0,
      provider_response: null,
      status: 'completed' as const,
      refund_amount_cents: 0,
      refund_reason: null,
      refunded_at: null,
      reference: 'Manual payment',
      notes: null,
      paid_by: null,
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    setInvoice({
      ...invoice,
      status: 'paid',
      amount_paid_cents: invoice.total_cents,
      paid_at: new Date().toISOString(),
      payments: [...(invoice.payments || []), newPayment],
    })
    
    alert('Invoice marked as paid!')
  }

  const handleVoid = async () => {
    if (!invoice) return
    
    if (!confirm('Are you sure you want to void this invoice? This action cannot be undone.')) {
      return
    }
    
    // Simulate voiding
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setInvoice({
      ...invoice,
      status: 'void',
    })
    
    alert('Invoice voided.')
  }

  const handleEdit = () => {
    alert('Edit invoice - coming soon')
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this draft invoice?')) {
      return
    }
    
    // Simulate deletion
    await new Promise(resolve => setTimeout(resolve, 500))
    router.push('/invoices')
  }

  const handleDuplicate = () => {
    alert('Duplicate invoice - coming soon')
  }

  const handleDownloadPdf = () => {
    alert('Download PDF - coming soon')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-slate-500">Loading invoice...</p>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          {error || 'Invoice not found'}
        </h2>
        <p className="text-slate-500 mb-4">
          The invoice you're looking for doesn't exist or you don't have access to it.
        </p>
        <Button onClick={handleBack}>
          Back to Invoices
        </Button>
      </div>
    )
  }

  return (
    <InvoiceDetail
      invoice={invoice}
      onBack={handleBack}
      onSend={handleSend}
      onMarkPaid={handleMarkPaid}
      onVoid={handleVoid}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
      onDownloadPdf={handleDownloadPdf}
      isStaff={true}
    />
  )
}
