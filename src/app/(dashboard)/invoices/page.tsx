'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InvoiceList } from '@/components/invoices'
import { Plus } from 'lucide-react'
import type { InvoiceWithRelations } from '@/types/invoices'

// Mock data for development
const MOCK_INVOICES: InvoiceWithRelations[] = [
  {
    id: '1',
    organization_id: 'org-1',
    client_org_id: 'client-1',
    invoice_number: 'KRE8I-2026-0001',
    line_items: [
      { id: '1', description: 'Website Development - Phase 1', quantity: 1, unit_price_cents: 500000, amount_cents: 500000 },
      { id: '2', description: 'Hosting Setup (Annual)', quantity: 1, unit_price_cents: 30000, amount_cents: 30000 },
    ],
    subtotal_cents: 530000,
    tax_rate: 0,
    tax_amount_cents: 0,
    discount_type: null,
    discount_value: 0,
    discount_amount_cents: 0,
    total_cents: 530000,
    amount_paid_cents: 0,
    currency: 'USD',
    status: 'sent',
    issue_date: '2026-01-15',
    due_date: '2026-02-14',
    sent_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    viewed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: null,
    payment_terms_id: null,
    notes: 'Thank you for your business!',
    terms: 'Payment due within 30 days.',
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
    updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    client_organization: {
      id: 'client-1',
      name: 'Acme Corporation',
      slug: 'acme-corp',
    },
  },
  {
    id: '2',
    organization_id: 'org-1',
    client_org_id: 'client-2',
    invoice_number: 'KRE8I-2026-0002',
    line_items: [
      { id: '1', description: 'Monthly Support Retainer - January 2026', quantity: 1, unit_price_cents: 150000, amount_cents: 150000 },
    ],
    subtotal_cents: 150000,
    tax_rate: 825, // 8.25%
    tax_amount_cents: 12375,
    discount_type: null,
    discount_value: 0,
    discount_amount_cents: 0,
    total_cents: 162375,
    amount_paid_cents: 162375,
    currency: 'USD',
    status: 'paid',
    issue_date: '2026-01-01',
    due_date: '2026-01-15',
    sent_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    viewed_at: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    payment_terms_id: null,
    notes: null,
    terms: null,
    footer: null,
    is_recurring: true,
    recurring_config: { frequency: 'monthly', next_date: '2026-02-01', end_date: null, occurrences_remaining: null },
    parent_invoice_id: null,
    project_id: null,
    contract_id: null,
    pdf_url: null,
    pdf_generated_at: null,
    created_by: 'staff-1',
    created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    client_organization: {
      id: 'client-2',
      name: 'TechStartup Inc',
      slug: 'techstartup',
    },
    payments: [
      {
        id: 'p1',
        invoice_id: '2',
        organization_id: 'org-1',
        amount_cents: 162375,
        currency: 'USD',
        method: 'stripe',
        provider: 'stripe',
        transaction_id: 'pi_xxx123',
        provider_fee_cents: 501,
        provider_response: null,
        status: 'completed',
        refund_amount_cents: 0,
        refund_reason: null,
        refunded_at: null,
        reference: null,
        notes: null,
        paid_by: 'client-user-1',
        paid_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ],
  },
  {
    id: '3',
    organization_id: 'org-1',
    client_org_id: 'client-3',
    invoice_number: 'KRE8I-2026-0003',
    line_items: [
      { id: '1', description: 'E-commerce Integration', quantity: 1, unit_price_cents: 250000, amount_cents: 250000 },
      { id: '2', description: 'Payment Gateway Setup', quantity: 1, unit_price_cents: 50000, amount_cents: 50000 },
    ],
    subtotal_cents: 300000,
    tax_rate: 0,
    tax_amount_cents: 0,
    discount_type: 'percentage',
    discount_value: 1000, // 10%
    discount_amount_cents: 30000,
    total_cents: 270000,
    amount_paid_cents: 0,
    currency: 'USD',
    status: 'overdue',
    issue_date: '2026-01-01',
    due_date: '2026-01-15',
    sent_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    viewed_at: null,
    paid_at: null,
    payment_terms_id: null,
    notes: '10% early project discount applied.',
    terms: null,
    footer: null,
    is_recurring: false,
    recurring_config: null,
    parent_invoice_id: null,
    project_id: null,
    contract_id: null,
    pdf_url: null,
    pdf_generated_at: null,
    created_by: 'staff-1',
    created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    client_organization: {
      id: 'client-3',
      name: 'Local Bakery Shop',
      slug: 'local-bakery',
    },
  },
  {
    id: '4',
    organization_id: 'org-1',
    client_org_id: 'client-1',
    invoice_number: 'KRE8I-2026-0004',
    line_items: [
      { id: '1', description: 'Website Development - Phase 2', quantity: 1, unit_price_cents: 750000, amount_cents: 750000 },
    ],
    subtotal_cents: 750000,
    tax_rate: 0,
    tax_amount_cents: 0,
    discount_type: null,
    discount_value: 0,
    discount_amount_cents: 0,
    total_cents: 750000,
    amount_paid_cents: 250000,
    currency: 'USD',
    status: 'partial',
    issue_date: '2026-01-20',
    due_date: '2026-02-19',
    sent_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    viewed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: null,
    payment_terms_id: null,
    notes: null,
    terms: null,
    footer: null,
    is_recurring: false,
    recurring_config: null,
    parent_invoice_id: null,
    project_id: null,
    contract_id: null,
    pdf_url: null,
    pdf_generated_at: null,
    created_by: 'staff-1',
    created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    client_organization: {
      id: 'client-1',
      name: 'Acme Corporation',
      slug: 'acme-corp',
    },
  },
  {
    id: '5',
    organization_id: 'org-1',
    client_org_id: 'client-2',
    invoice_number: 'KRE8I-2026-0005',
    line_items: [
      { id: '1', description: 'Monthly Support Retainer - February 2026', quantity: 1, unit_price_cents: 150000, amount_cents: 150000 },
    ],
    subtotal_cents: 150000,
    tax_rate: 825,
    tax_amount_cents: 12375,
    discount_type: null,
    discount_value: 0,
    discount_amount_cents: 0,
    total_cents: 162375,
    amount_paid_cents: 0,
    currency: 'USD',
    status: 'draft',
    issue_date: null,
    due_date: '2026-02-15',
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    payment_terms_id: null,
    notes: null,
    terms: null,
    footer: null,
    is_recurring: true,
    recurring_config: { frequency: 'monthly', next_date: '2026-03-01', end_date: null, occurrences_remaining: null },
    parent_invoice_id: '2',
    project_id: null,
    contract_id: null,
    pdf_url: null,
    pdf_generated_at: null,
    created_by: 'staff-1',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    client_organization: {
      id: 'client-2',
      name: 'TechStartup Inc',
      slug: 'techstartup',
    },
  },
]

export default function InvoicesPage() {
  const [invoices] = useState<InvoiceWithRelations[]>(MOCK_INVOICES)
  const router = useRouter()

  const handleInvoiceClick = (invoice: InvoiceWithRelations) => {
    router.push(`/invoices/${invoice.id}`)
  }

  const handleCreateClick = () => {
    // TODO: Open create invoice form/page
    alert('Create invoice - coming soon')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Invoices
          </h2>
          <p className="text-slate-500 mt-1 hidden md:block">
            Manage invoices and track payments
          </p>
        </div>
        
        <Button onClick={handleCreateClick} className="gap-2 hidden md:flex">
          <Plus size={18} />
          Create Invoice
        </Button>
      </div>

      {/* Invoice list */}
      <InvoiceList
        invoices={invoices}
        onInvoiceClick={handleInvoiceClick}
        onCreateClick={handleCreateClick}
      />
    </div>
  )
}
