/**
 * Type exports for KT-Portal
 *
 * This file re-exports types from various modules for convenient imports.
 * In production, database types would also be exported from ./database.ts
 * after running: `supabase gen types typescript --local > src/types/database.ts`
 */

// Plan-related types
export * from './plans'

// Ticket-related types
export * from './tickets'

// Invoice-related types (exclude utility functions that conflict with plans)
export type {
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  InvoiceLineItem,
  RecurringConfig,
  Invoice,
  InvoiceWithRelations,
  Payment,
  CreditNote,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  RecordPaymentInput,
} from './invoices'
export {
  INVOICE_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  formatCents,
  centsToDollars,
  calculateInvoiceTotals,
} from './invoices'

// Organization-related types
export * from './organizations'

// AI service types
export * from './ai'
