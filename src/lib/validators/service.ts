import { z } from 'zod'

// Service creation/update schema
export const serviceSchema = z.object({
  // Optional: super admins may create services for a specific organization.
  // For non-super-admins, the API will ignore this and use the caller's organization_id.
  organization_id: z.string().uuid('Invalid organization ID').optional(),
  name: z.string().min(3, 'Name must be at least 3 characters').max(200, 'Name too long'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description too long').optional().nullable(),
  category: z.enum(['custom_code', 'custom_software', 'custom_plugin', 'maintenance', 'support', 'consulting', 'other']),
  base_rate: z.number().min(0, 'Rate must be positive').max(1000000, 'Rate too high'),
  rate_type: z.enum(['hourly', 'fixed', 'tiered', 'custom']),
  estimated_hours: z.number().min(0).max(10000).optional().nullable(),
  requires_approval: z.boolean().default(true),
  is_active: z.boolean().default(true),
  is_global: z.boolean().default(false),
  display_order: z.number().int().min(0).default(0),
})

export type ServiceInput = z.infer<typeof serviceSchema>

// Service request creation schema
export const serviceRequestSchema = z.object({
  service_id: z.string().uuid('Invalid service ID'),
  details: z.record(z.any()).optional().nullable(),
  requested_start_date: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
})

export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>

// Service request approval/rejection schema
export const serviceRequestApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejection_reason: z.string().min(10).optional(),
  internal_notes: z.string().max(2000).optional().nullable(),
})

export type ServiceRequestApprovalInput = z.infer<typeof serviceRequestApprovalSchema>

// Admin response schema
export const adminResponseSchema = z.object({
  response_text: z.string().min(20, 'Response must be at least 20 characters').max(5000, 'Response too long'),
  response_metadata: z.record(z.any()).optional().nullable(),
})

export type AdminResponseInput = z.infer<typeof adminResponseSchema>

// Client feedback/approval schema
export const clientFeedbackSchema = z.object({
  response_text: z.string().min(10, 'Feedback must be at least 10 characters').max(5000, 'Feedback too long'),
  is_approval: z.boolean().default(false),
})

export type ClientFeedbackInput = z.infer<typeof clientFeedbackSchema>
