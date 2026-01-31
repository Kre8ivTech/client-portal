import { z } from 'zod'

export const createTicketSchema = z.object({
  subject: z.string().min(5, { message: 'Subject must be at least 5 characters.' }),
  description: z.string().min(20, { message: 'Description must be at least 20 characters.' }),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string().min(1, { message: 'Please select a category.' }),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>

export const TICKET_CATEGORIES = [
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'billing_payment', label: 'Billing & Payments' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'account_access', label: 'Account Access' },
] as const
