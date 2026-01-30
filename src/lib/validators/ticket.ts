import { z } from 'zod'

export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export const ticketStatusSchema = z.enum([
  'new',
  'open',
  'in_progress',
  'pending_client',
  'resolved',
  'closed',
])

export const createTicketSchema = z.object({
  subject: z.string().min(5).max(500),
  description: z.string().min(20).max(10000),
  priority: ticketPrioritySchema,
  category: z.string().min(1).max(100),
})

export const createTicketCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  is_internal: z.boolean().optional(),
})

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>
export type CreateTicketCommentInput = z.infer<typeof createTicketCommentSchema>
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>
