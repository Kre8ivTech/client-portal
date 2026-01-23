import { z } from 'zod'

// =============================================================================
// ENUMS
// =============================================================================

export const planStatusSchema = z.enum([
  'pending',
  'active',
  'paused',
  'grace_period',
  'cancelled',
  'expired',
])

export const coverageTypeSchema = z.enum(['support', 'dev', 'both'])

export const disputeStatusSchema = z.enum([
  'pending',
  'under_review',
  'resolved',
  'rejected',
])

export const disputeTypeSchema = z.enum([
  'time_logged',
  'invoice_amount',
  'coverage',
  'other',
])

// =============================================================================
// INVOICE TEMPLATE SCHEMAS
// =============================================================================

export const lineItemFormatSchema = z.object({
  show_date: z.boolean().default(true),
  show_description: z.boolean().default(true),
  show_hours: z.boolean().default(true),
  show_rate: z.boolean().default(true),
  show_amount: z.boolean().default(true),
  group_by_type: z.boolean().default(true),
})

export const createInvoiceTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  header_text: z.string().max(5000).optional(),
  footer_text: z.string().max(5000).optional(),
  terms_text: z.string().max(5000).optional(),
  line_item_format: lineItemFormatSchema.optional(),
  show_hours_breakdown: z.boolean().default(true),
  show_rate_details: z.boolean().default(true),
  show_plan_summary: z.boolean().default(true),
  logo_url: z.string().url().optional(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
    .default('#000000'),
  accent_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
    .default('#666666'),
  is_default: z.boolean().default(false),
})

export const updateInvoiceTemplateSchema = createInvoiceTemplateSchema.partial()

// =============================================================================
// PLAN SCHEMAS
// =============================================================================

export const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),

  // Hours allocation (separate pools)
  support_hours_included: z.number().int().min(0).default(0),
  dev_hours_included: z.number().int().min(0).default(0),

  // Hourly rates in cents (e.g., 12500 = $125.00)
  support_hourly_rate: z
    .number()
    .int()
    .min(0)
    .describe('Support overage rate in cents'),
  dev_hourly_rate: z
    .number()
    .int()
    .min(0)
    .describe('Dev overage rate in cents'),

  // Monthly fee in cents (e.g., 50000 = $500.00)
  monthly_fee: z.number().int().min(0).describe('Monthly plan fee in cents'),
  currency: z.string().length(3).default('USD'),

  // Billing configuration
  payment_terms_days: z.number().int().min(1).max(365).default(30),
  auto_send_invoices: z.boolean().default(false),
  invoice_template_id: z.string().uuid().optional(),

  // Rush support
  rush_support_included: z.boolean().default(false),
  rush_support_fee: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Rush fee in cents if not included'),
  rush_priority_boost: z.number().int().min(1).max(100).default(5),

  // Plan metadata
  is_template: z.boolean().default(true),
})

export const updatePlanSchema = createPlanSchema.partial()

// Helper to convert dollars to cents for API input
export const planInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  support_hours_included: z.number().int().min(0).default(0),
  dev_hours_included: z.number().int().min(0).default(0),
  // Accept dollars, convert to cents in application
  support_hourly_rate_dollars: z.number().min(0),
  dev_hourly_rate_dollars: z.number().min(0),
  monthly_fee_dollars: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  payment_terms_days: z.number().int().min(1).max(365).default(30),
  auto_send_invoices: z.boolean().default(false),
  invoice_template_id: z.string().uuid().optional(),
  rush_support_included: z.boolean().default(false),
  rush_support_fee_dollars: z.number().min(0).default(0),
  rush_priority_boost: z.number().int().min(1).max(100).default(5),
  is_template: z.boolean().default(true),
})

// =============================================================================
// PLAN COVERAGE ITEM SCHEMAS
// =============================================================================

export const createPlanCoverageItemSchema = z.object({
  plan_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  coverage_type: coverageTypeSchema.default('support'),
})

export const updatePlanCoverageItemSchema =
  createPlanCoverageItemSchema.partial().omit({ plan_id: true })

// Batch create coverage items
export const batchCreateCoverageItemsSchema = z.object({
  plan_id: z.string().uuid(),
  items: z.array(
    z.object({
      name: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      coverage_type: coverageTypeSchema.default('support'),
    })
  ),
})

// =============================================================================
// PLAN ASSIGNMENT (SUBSCRIPTION) SCHEMAS
// =============================================================================

export const createPlanAssignmentSchema = z.object({
  plan_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  partner_client_org_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  billing_cycle_day: z.number().int().min(1).max(28),
  auto_renew: z.boolean().default(true),
})

export const updatePlanAssignmentSchema = z.object({
  auto_renew: z.boolean().optional(),
  status: planStatusSchema.optional(),
})

// Schema for requesting cancellation (client/partner use)
export const requestCancellationSchema = z.object({
  cancellation_reason: z.string().max(2000).optional(),
})

// Schema for admin to process cancellation
export const processCancellationSchema = z.object({
  plan_assignment_id: z.string().uuid(),
  approved: z.boolean(),
  proration_credit: z.number().int().min(0).optional(),
  cancellation_notes: z.string().max(2000).optional(),
})

// Schema for mid-cycle plan change (upgrade/downgrade)
export const changePlanSchema = z.object({
  plan_assignment_id: z.string().uuid(),
  new_plan_id: z.string().uuid(),
  effective_immediately: z.boolean().default(true),
  prorate: z.boolean().default(true),
})

// =============================================================================
// BILLING DISPUTE SCHEMAS
// =============================================================================

export const createBillingDisputeSchema = z.object({
  invoice_id: z.string().uuid().optional(),
  plan_assignment_id: z.string().uuid().optional(),
  ticket_id: z.string().uuid().optional(),
  time_entry_id: z.string().uuid().optional(),
  dispute_type: disputeTypeSchema,
  description: z.string().min(10).max(5000),
  supporting_documents: z.array(z.string().url()).default([]),
})

export const updateBillingDisputeSchema = z.object({
  description: z.string().min(10).max(5000).optional(),
  supporting_documents: z.array(z.string().url()).optional(),
})

// Admin resolution schema
export const resolveBillingDisputeSchema = z.object({
  dispute_id: z.string().uuid(),
  status: z.enum(['resolved', 'rejected']),
  resolution: z.string().max(5000),
  credit_amount: z.number().int().min(0).optional(),
  credit_applied_to_invoice_id: z.string().uuid().optional(),
})

// =============================================================================
// OVERAGE ACCEPTANCE SCHEMAS
// =============================================================================

export const createOverageRequestSchema = z.object({
  plan_assignment_id: z.string().uuid(),
  overage_type: z.enum(['support', 'dev']),
  estimated_hours: z.number().positive(),
  ticket_id: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
})

export const respondToOverageSchema = z.object({
  overage_id: z.string().uuid(),
  accepted: z.boolean(),
  rejection_reason: z.string().max(1000).optional(),
})

export const approveOverageInvoiceSchema = z.object({
  overage_id: z.string().uuid(),
})

// =============================================================================
// QUERY SCHEMAS (for list/filter endpoints)
// =============================================================================

export const listPlansQuerySchema = z.object({
  is_template: z.boolean().optional(),
  is_active: z.boolean().optional(),
  min_monthly_fee: z.number().int().min(0).optional(),
  max_monthly_fee: z.number().int().optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export const listPlanAssignmentsQuerySchema = z.object({
  organization_id: z.string().uuid().optional(),
  plan_id: z.string().uuid().optional(),
  status: planStatusSchema.optional(),
  auto_renew: z.boolean().optional(),
  upcoming_renewal_days: z.number().int().min(1).max(90).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export const listBillingDisputesQuerySchema = z.object({
  organization_id: z.string().uuid().optional(),
  status: disputeStatusSchema.optional(),
  dispute_type: disputeTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PlanStatus = z.infer<typeof planStatusSchema>
export type CoverageType = z.infer<typeof coverageTypeSchema>
export type DisputeStatus = z.infer<typeof disputeStatusSchema>
export type DisputeType = z.infer<typeof disputeTypeSchema>

export type CreateInvoiceTemplateInput = z.infer<
  typeof createInvoiceTemplateSchema
>
export type UpdateInvoiceTemplateInput = z.infer<
  typeof updateInvoiceTemplateSchema
>

export type CreatePlanInput = z.infer<typeof createPlanSchema>
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>
export type PlanInput = z.infer<typeof planInputSchema>

export type CreatePlanCoverageItemInput = z.infer<
  typeof createPlanCoverageItemSchema
>
export type UpdatePlanCoverageItemInput = z.infer<
  typeof updatePlanCoverageItemSchema
>
export type BatchCreateCoverageItemsInput = z.infer<
  typeof batchCreateCoverageItemsSchema
>

export type CreatePlanAssignmentInput = z.infer<
  typeof createPlanAssignmentSchema
>
export type UpdatePlanAssignmentInput = z.infer<
  typeof updatePlanAssignmentSchema
>
export type RequestCancellationInput = z.infer<typeof requestCancellationSchema>
export type ProcessCancellationInput = z.infer<typeof processCancellationSchema>
export type ChangePlanInput = z.infer<typeof changePlanSchema>

export type CreateBillingDisputeInput = z.infer<
  typeof createBillingDisputeSchema
>
export type UpdateBillingDisputeInput = z.infer<
  typeof updateBillingDisputeSchema
>
export type ResolveBillingDisputeInput = z.infer<
  typeof resolveBillingDisputeSchema
>

export type CreateOverageRequestInput = z.infer<
  typeof createOverageRequestSchema
>
export type RespondToOverageInput = z.infer<typeof respondToOverageSchema>
export type ApproveOverageInvoiceInput = z.infer<
  typeof approveOverageInvoiceSchema
>

export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>
export type ListPlanAssignmentsQuery = z.infer<
  typeof listPlanAssignmentsQuerySchema
>
export type ListBillingDisputesQuery = z.infer<
  typeof listBillingDisputesQuerySchema
>
