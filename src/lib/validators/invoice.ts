import { z } from 'zod'

// Invoice line item schema
export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  quantity: z.number().min(0.01, 'Quantity must be positive').max(10000, 'Quantity too large'),
  unit_price: z.number().min(0, 'Price must be non-negative').max(1000000, 'Price too large'),
  amount: z.number().min(0, 'Amount must be non-negative'),
})

export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>

// Invoice creation/update schema
export const invoiceSchema = z.object({
  invoice_number: z.string()
    .min(1, 'Invoice number is required')
    .max(50, 'Invoice number too long')
    .regex(/^[A-Z0-9-]+$/, 'Invoice number must contain only uppercase letters, numbers, and hyphens'),

  status: z.enum(['draft', 'pending', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'])
    .default('draft'),

  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),

  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional().nullable(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional().nullable(),

  subtotal: z.number().min(0, 'Subtotal must be non-negative'),
  tax_rate: z.number().min(0, 'Tax rate must be non-negative').max(1, 'Tax rate cannot exceed 100%').default(0),
  tax_amount: z.number().min(0, 'Tax amount must be non-negative'),
  discount_amount: z.number().min(0, 'Discount must be non-negative').default(0),
  discount_description: z.string().max(255).optional().nullable(),
  total: z.number().min(0, 'Total must be non-negative'),

  payment_terms_days: z.number().int().min(0).max(365).default(30),

  notes: z.string().max(5000).optional().nullable(),
  internal_notes: z.string().max(5000).optional().nullable(),

  line_items: z.array(invoiceLineItemSchema).min(1, 'At least one line item is required'),
})

export type InvoiceInput = z.infer<typeof invoiceSchema>

// Invoice update status schema (for quick status changes)
export const invoiceStatusUpdateSchema = z.object({
  status: z.enum(['draft', 'pending', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded']),
  internal_notes: z.string().max(5000).optional().nullable(),
})

export type InvoiceStatusUpdateInput = z.infer<typeof invoiceStatusUpdateSchema>

// Helper function to calculate invoice totals
export function calculateInvoiceTotals(lineItems: InvoiceLineItemInput[], taxRate: number = 0, discountAmount: number = 0) {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_price)
  }, 0)

  const taxAmount = Math.round(subtotal * taxRate)
  const total = subtotal + taxAmount - discountAmount

  return {
    subtotal: Math.round(subtotal),
    taxAmount: Math.round(taxAmount),
    total: Math.round(total),
    balance_due: Math.round(total),
  }
}
