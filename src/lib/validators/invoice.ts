/**
 * Invoice Validation Schemas
 * Using Zod for runtime validation
 */

import { z } from 'zod'

// Invoice status
export const invoiceStatusSchema = z.enum([
  'draft',
  'sent',
  'viewed',
  'partial',
  'paid',
  'overdue',
  'void',
  'cancelled',
])

// Payment status
export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'cancelled',
])

// Payment method
export const paymentMethodSchema = z.enum([
  'stripe',
  'paypal',
  'bank_transfer',
  'check',
  'cash',
  'credit',
])

// Line item schema
export const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be positive'),
  unit_price_cents: z.number().int().min(0, 'Price cannot be negative'),
  amount_cents: z.number().int().min(0),
  taxable: z.boolean().optional(),
})

// Recurring config schema
export const recurringConfigSchema = z.object({
  frequency: z.enum(['monthly', 'quarterly', 'yearly']),
  end_date: z.string().datetime().nullable().optional(),
  occurrences_remaining: z.number().int().positive().nullable().optional(),
})

// Create invoice schema
export const createInvoiceSchema = z.object({
  client_org_id: z.string().uuid('Invalid client organization'),
  line_items: z
    .array(lineItemSchema.omit({ amount_cents: true }))
    .min(1, 'At least one line item is required')
    .max(50, 'Maximum 50 line items'),
  tax_rate: z
    .number()
    .int()
    .min(0)
    .max(10000) // Max 100% in basis points
    .optional()
    .default(0),
  discount_type: z.enum(['percentage', 'fixed']).optional(),
  discount_value: z.number().int().min(0).optional().default(0),
  due_date: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Invalid due date'
  ),
  issue_date: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Invalid issue date'
  ).optional(),
  payment_terms_id: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(5000).optional(),
  footer: z.string().max(500).optional(),
  is_recurring: z.boolean().optional().default(false),
  recurring_config: recurringConfigSchema.optional(),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

// Update invoice schema
export const updateInvoiceSchema = z.object({
  line_items: z
    .array(lineItemSchema.omit({ amount_cents: true }))
    .min(1)
    .max(50)
    .optional(),
  tax_rate: z.number().int().min(0).max(10000).optional(),
  discount_type: z.enum(['percentage', 'fixed']).nullable().optional(),
  discount_value: z.number().int().min(0).optional(),
  due_date: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Invalid due date'
  ).optional(),
  issue_date: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Invalid issue date'
  ).optional(),
  payment_terms_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  terms: z.string().max(5000).nullable().optional(),
  footer: z.string().max(500).nullable().optional(),
  status: invoiceStatusSchema.optional(),
})

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>

// Record payment schema
export const recordPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount_cents: z.number().int().positive('Amount must be positive'),
  method: paymentMethodSchema,
  reference: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  paid_at: z.string().datetime().optional(),
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

// Create credit note schema
export const createCreditNoteSchema = z.object({
  invoice_id: z.string().uuid().optional(),
  client_org_id: z.string().uuid(),
  amount_cents: z.number().int().positive('Amount must be positive'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
})

export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>

// Invoice filters schema
export const invoiceFiltersSchema = z.object({
  status: z
    .union([invoiceStatusSchema, z.array(invoiceStatusSchema)])
    .optional(),
  client_org_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  overdue_only: z.boolean().optional(),
  search: z.string().max(200).optional(),
})

export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>

// Send invoice schema
export const sendInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  email_to: z.string().email().optional(), // Uses client email if not provided
  email_cc: z.array(z.string().email()).max(5).optional(),
  email_subject: z.string().max(200).optional(),
  email_message: z.string().max(2000).optional(),
  attach_pdf: z.boolean().optional().default(true),
})

export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>
