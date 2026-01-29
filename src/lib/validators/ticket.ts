/**
 * Ticket Validation Schemas
 * Using Zod for runtime validation
 */

import { z } from 'zod'

// Priority enum
export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// Status enum
export const ticketStatusSchema = z.enum([
  'new',
  'open',
  'in_progress',
  'pending_client',
  'resolved',
  'closed',
])

// Attachment schema
export const ticketAttachmentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1).max(255),
  url: z.string().url(),
  size: z.number().int().positive().max(50 * 1024 * 1024), // 50MB max
  type: z.string().min(1).max(100),
})

// Create ticket schema
export const createTicketSchema = z.object({
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(500, 'Subject must be less than 500 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(10000, 'Description must be less than 10,000 characters'),
  priority: ticketPrioritySchema.default('medium'),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  client_org_id: z.string().uuid().optional(), // For partners
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>

// Update ticket schema (all fields optional)
export const updateTicketSchema = z.object({
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(500, 'Subject must be less than 500 characters')
    .optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(10000, 'Description must be less than 10,000 characters')
    .optional(),
  priority: ticketPrioritySchema.optional(),
  status: ticketStatusSchema.optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
})

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>

// Create comment schema
export const createCommentSchema = z.object({
  ticket_id: z.string().uuid(),
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(10000, 'Comment must be less than 10,000 characters'),
  is_internal: z.boolean().default(false),
  attachments: z.array(ticketAttachmentSchema).max(10).optional(),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>

// Update comment schema
export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(10000, 'Comment must be less than 10,000 characters'),
})

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>

// Ticket filters schema (for query params)
export const ticketFiltersSchema = z.object({
  status: z
    .union([ticketStatusSchema, z.array(ticketStatusSchema)])
    .optional(),
  priority: z
    .union([ticketPrioritySchema, z.array(ticketPrioritySchema)])
    .optional(),
  category: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  created_by: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
})

export type TicketFilters = z.infer<typeof ticketFiltersSchema>

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

// Sort schema
export const ticketSortSchema = z.object({
  field: z
    .enum(['created_at', 'updated_at', 'priority', 'status', 'queue_position'])
    .default('created_at'),
  direction: z.enum(['asc', 'desc']).default('desc'),
})

export type TicketSort = z.infer<typeof ticketSortSchema>
