import { z } from 'zod'
import { TICKET_PRIORITIES } from '@/lib/ticket-priority'

export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES)

export const createTicketSchema = z.object({
  subject: z.string().min(5, { message: 'Subject must be at least 5 characters.' }),
  description: z.string().min(20, { message: 'Description must be at least 20 characters.' }),
  priority: ticketPrioritySchema,
  category: z.string().min(1, { message: 'Please select a category.' }),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').nullable().optional(),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>

export const updateTicketPrioritySchema = z.object({
  priority: ticketPrioritySchema,
})

export type UpdateTicketPriorityInput = z.infer<typeof updateTicketPrioritySchema>

export const TICKET_CATEGORIES = [
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'billing_payment', label: 'Billing & Payments' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'account_access', label: 'Account Access' },
] as const
