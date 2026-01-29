/**
 * Invoice Types for KT-Portal
 */

// Invoice status
export type InvoiceStatus = 
  | 'draft' 
  | 'sent' 
  | 'viewed' 
  | 'partial' 
  | 'paid' 
  | 'overdue' 
  | 'void' 
  | 'cancelled'

// Payment status
export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'refunded' 
  | 'cancelled'

// Payment method
export type PaymentMethod = 
  | 'stripe' 
  | 'paypal' 
  | 'bank_transfer' 
  | 'check' 
  | 'cash' 
  | 'credit'

// Line item structure
export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
  taxable?: boolean
}

// Recurring config
export interface RecurringConfig {
  frequency: 'monthly' | 'quarterly' | 'yearly'
  next_date: string
  end_date: string | null
  occurrences_remaining: number | null
}

// Database row type
export interface Invoice {
  id: string
  organization_id: string
  client_org_id: string
  invoice_number: string
  line_items: InvoiceLineItem[]
  subtotal_cents: number
  tax_rate: number
  tax_amount_cents: number
  discount_type: 'percentage' | 'fixed' | null
  discount_value: number
  discount_amount_cents: number
  total_cents: number
  amount_paid_cents: number
  currency: string
  status: InvoiceStatus
  issue_date: string | null
  due_date: string
  sent_at: string | null
  viewed_at: string | null
  paid_at: string | null
  payment_terms_id: string | null
  notes: string | null
  terms: string | null
  footer: string | null
  is_recurring: boolean
  recurring_config: RecurringConfig | null
  parent_invoice_id: string | null
  project_id: string | null
  contract_id: string | null
  pdf_url: string | null
  pdf_generated_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Invoice with expanded relations
export interface InvoiceWithRelations extends Invoice {
  organization?: {
    id: string
    name: string
    slug: string
  }
  client_organization?: {
    id: string
    name: string
    slug: string
  }
  payment_terms?: {
    id: string
    name: string
    days: number
  }
  payments?: Payment[]
  created_by_profile?: {
    id: string
    name: string | null
    email: string
  }
}

// Payment
export interface Payment {
  id: string
  invoice_id: string
  organization_id: string
  amount_cents: number
  currency: string
  method: PaymentMethod
  provider: string | null
  transaction_id: string | null
  provider_fee_cents: number
  provider_response: Record<string, unknown> | null
  status: PaymentStatus
  refund_amount_cents: number
  refund_reason: string | null
  refunded_at: string | null
  reference: string | null
  notes: string | null
  paid_by: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

// Credit note
export interface CreditNote {
  id: string
  organization_id: string
  invoice_id: string | null
  client_org_id: string
  credit_note_number: string
  amount_cents: number
  currency: string
  reason: string
  status: 'draft' | 'issued' | 'applied' | 'void'
  applied_to_invoice_id: string | null
  applied_at: string | null
  issued_by: string | null
  issued_at: string | null
  created_at: string
  updated_at: string
}

// Input types for forms
export interface CreateInvoiceInput {
  client_org_id: string
  line_items: Omit<InvoiceLineItem, 'id'>[]
  tax_rate?: number
  discount_type?: 'percentage' | 'fixed'
  discount_value?: number
  due_date: string
  issue_date?: string
  payment_terms_id?: string
  notes?: string
  terms?: string
  footer?: string
  is_recurring?: boolean
  recurring_config?: Omit<RecurringConfig, 'next_date'>
}

export interface UpdateInvoiceInput {
  line_items?: Omit<InvoiceLineItem, 'id'>[]
  tax_rate?: number
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number
  due_date?: string
  issue_date?: string
  payment_terms_id?: string | null
  notes?: string | null
  terms?: string | null
  footer?: string | null
  status?: InvoiceStatus
}

export interface RecordPaymentInput {
  invoice_id: string
  amount_cents: number
  method: PaymentMethod
  reference?: string
  notes?: string
  paid_at?: string
}

// Filter options
export interface InvoiceFilters {
  status?: InvoiceStatus | InvoiceStatus[]
  client_org_id?: string
  date_from?: string
  date_to?: string
  overdue_only?: boolean
  search?: string
}

// Status display helpers
export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  sent: { label: 'Sent', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  viewed: { label: 'Viewed', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  partial: { label: 'Partial', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  paid: { label: 'Paid', color: 'text-green-600', bgColor: 'bg-green-100' },
  overdue: { label: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-100' },
  void: { label: 'Void', color: 'text-slate-500', bgColor: 'bg-slate-100' },
  cancelled: { label: 'Cancelled', color: 'text-slate-500', bgColor: 'bg-slate-100' },
}

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-600' },
  processing: { label: 'Processing', color: 'text-blue-600' },
  completed: { label: 'Completed', color: 'text-green-600' },
  failed: { label: 'Failed', color: 'text-red-600' },
  refunded: { label: 'Refunded', color: 'text-purple-600' },
  cancelled: { label: 'Cancelled', color: 'text-slate-500' },
}

// Currency formatting helpers
export function formatCents(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

// Calculate invoice totals
export function calculateInvoiceTotals(
  lineItems: InvoiceLineItem[],
  taxRate: number = 0,
  discountType: 'percentage' | 'fixed' | null = null,
  discountValue: number = 0
): {
  subtotal_cents: number
  tax_amount_cents: number
  discount_amount_cents: number
  total_cents: number
} {
  const subtotal_cents = lineItems.reduce((sum, item) => sum + item.amount_cents, 0)
  
  let discount_amount_cents = 0
  if (discountType === 'percentage') {
    discount_amount_cents = Math.round(subtotal_cents * (discountValue / 10000)) // discountValue is in basis points
  } else if (discountType === 'fixed') {
    discount_amount_cents = discountValue
  }
  
  const taxable_amount = subtotal_cents - discount_amount_cents
  const tax_amount_cents = Math.round(taxable_amount * (taxRate / 10000)) // taxRate is in basis points
  
  const total_cents = taxable_amount + tax_amount_cents
  
  return {
    subtotal_cents,
    tax_amount_cents,
    discount_amount_cents,
    total_cents,
  }
}
