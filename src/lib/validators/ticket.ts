import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(255),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.enum(['technical_support', 'billing', 'general_inquiry', 'bug_report', 'feature_request']).default('general_inquiry'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  status: z.enum(['new', 'open', 'in_progress', 'pending_client', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: z.string().uuid().optional(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
  is_internal: z.boolean().default(false),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
