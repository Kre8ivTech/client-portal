/**
 * Plan Configuration Types
 *
 * These types mirror the database schema for plans and related tables.
 * In production, these would be auto-generated from Supabase using:
 * `supabase gen types typescript --local > src/types/database.ts`
 */

// =============================================================================
// ENUM TYPES
// =============================================================================

export type PlanStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'grace_period'
  | 'cancelled'
  | 'expired'

export type CoverageType = 'support' | 'dev' | 'both'

export type DisputeStatus =
  | 'pending'
  | 'under_review'
  | 'resolved'
  | 'rejected'

export type DisputeType =
  | 'time_logged'
  | 'invoice_amount'
  | 'coverage'
  | 'other'

// =============================================================================
// INVOICE TEMPLATE TYPES
// =============================================================================

export interface LineItemFormat {
  show_date: boolean
  show_description: boolean
  show_hours: boolean
  show_rate: boolean
  show_amount: boolean
  group_by_type: boolean
}

export interface InvoiceTemplate {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  header_text: string | null
  footer_text: string | null
  terms_text: string | null
  line_item_format: LineItemFormat
  show_hours_breakdown: boolean
  show_rate_details: boolean
  show_plan_summary: boolean
  logo_url: string | null
  primary_color: string
  accent_color: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// =============================================================================
// PLAN TYPES
// =============================================================================

export interface Plan {
  id: string
  organization_id: string | null
  name: string
  description: string | null

  // Hours allocation (separate pools)
  support_hours_included: number
  dev_hours_included: number

  // Rates in cents
  support_hourly_rate: number
  dev_hourly_rate: number

  // Monthly fee in cents
  monthly_fee: number
  currency: string

  // Billing configuration
  payment_terms_days: number
  auto_send_invoices: boolean
  invoice_template_id: string | null

  // Rush support
  rush_support_included: boolean
  rush_support_fee: number
  rush_priority_boost: number

  // Metadata
  is_template: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// Plan with related data
export interface PlanWithCoverage extends Plan {
  coverage_items: PlanCoverageItem[]
}

export interface PlanWithTemplate extends Plan {
  invoice_template: InvoiceTemplate | null
}

export interface PlanFull extends Plan {
  coverage_items: PlanCoverageItem[]
  invoice_template: InvoiceTemplate | null
}

// =============================================================================
// PLAN COVERAGE ITEM TYPES
// =============================================================================

export interface PlanCoverageItem {
  id: string
  plan_id: string
  name: string
  description: string | null
  coverage_type: CoverageType
  is_active: boolean
  created_at: string
  updated_at: string
}

// =============================================================================
// PLAN ASSIGNMENT (SUBSCRIPTION) TYPES
// =============================================================================

export interface PlanAssignment {
  id: string
  plan_id: string
  organization_id: string
  partner_client_org_id: string | null

  // Billing cycle
  start_date: string
  next_billing_date: string
  billing_cycle_day: number

  // Status
  status: PlanStatus
  auto_renew: boolean

  // Hour tracking (current period)
  support_hours_used: number
  dev_hours_used: number
  last_hours_reset_date: string | null

  // Grace period
  grace_period_start: string | null
  grace_period_end: string | null
  failed_payment_count: number
  last_payment_attempt: string | null

  // Cancellation
  cancellation_requested_at: string | null
  cancellation_requested_by: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  cancelled_by: string | null

  // Proration
  proration_credit: number

  // Contract link
  contract_id: string | null

  // Timestamps
  created_at: string
  updated_at: string
}

// Plan assignment with related plan details
export interface PlanAssignmentWithPlan extends PlanAssignment {
  plan: Plan
}

// Full plan assignment with all related data
export interface PlanAssignmentFull extends PlanAssignment {
  plan: PlanFull
  organization: {
    id: string
    name: string
    type: string
  }
  partner_client_org?: {
    id: string
    name: string
  } | null
}

// =============================================================================
// BILLING DISPUTE TYPES
// =============================================================================

export interface BillingDispute {
  id: string
  organization_id: string
  submitted_by: string
  invoice_id: string | null
  plan_assignment_id: string | null
  ticket_id: string | null
  time_entry_id: string | null
  dispute_type: DisputeType
  description: string
  supporting_documents: string[]
  status: DisputeStatus
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  credit_amount: number
  credit_applied_to_invoice_id: string | null
  created_at: string
  updated_at: string
}

// Billing dispute with related data
export interface BillingDisputeWithDetails extends BillingDispute {
  submitted_by_profile: {
    id: string
    name: string
    email: string
  }
  resolved_by_profile?: {
    id: string
    name: string
  } | null
  plan_assignment?: PlanAssignment | null
}

// =============================================================================
// PLAN RENEWAL NOTIFICATION TYPES
// =============================================================================

export interface PlanRenewalNotification {
  id: string
  plan_assignment_id: string
  days_before_renewal: 1 | 5 | 15 | 30
  scheduled_for: string
  sent_at: string | null
  acknowledged_at: string | null
  acknowledged_by: string | null
  created_at: string
}

// =============================================================================
// PLAN HOUR LOG TYPES
// =============================================================================

export interface PlanHourLog {
  id: string
  plan_assignment_id: string
  period_start: string
  period_end: string
  support_hours_used: number
  dev_hours_used: number
  support_overage_hours: number
  dev_overage_hours: number
  overage_invoice_id: string | null
  is_current_period: boolean
  created_at: string
  updated_at: string
}

// =============================================================================
// OVERAGE ACCEPTANCE TYPES
// =============================================================================

export interface OverageAcceptance {
  id: string
  plan_assignment_id: string
  requested_by: string
  requested_at: string
  overage_type: CoverageType
  estimated_hours: number
  hourly_rate: number
  estimated_total: number
  ticket_id: string | null
  description: string | null
  accepted: boolean | null
  accepted_at: string | null
  accepted_by: string | null
  rejection_reason: string | null
  invoice_id: string | null
  invoice_approved: boolean
  invoice_approved_at: string | null
  invoice_approved_by: string | null
  created_at: string
  updated_at: string
}

// Overage with related data
export interface OverageAcceptanceWithDetails extends OverageAcceptance {
  requested_by_profile: {
    id: string
    name: string
    email: string
  }
  plan_assignment: PlanAssignmentWithPlan
}

// =============================================================================
// HELPER TYPES FOR UI
// =============================================================================

// Plan summary for dashboard widget
export interface PlanSummary {
  plan_name: string
  status: PlanStatus
  support_hours_remaining: number
  support_hours_included: number
  dev_hours_remaining: number
  dev_hours_included: number
  days_until_renewal: number
  next_billing_date: string
  monthly_fee_formatted: string
  has_rush_support: boolean
  in_grace_period: boolean
}

// Hour usage breakdown
export interface HourUsageBreakdown {
  type: 'support' | 'dev'
  hours_included: number
  hours_used: number
  hours_remaining: number
  overage_hours: number
  overage_rate: number
  overage_cost: number
}

// Invoice preview for plan
export interface PlanInvoicePreview {
  plan_name: string
  billing_period_start: string
  billing_period_end: string
  monthly_fee: number
  line_items: Array<{
    description: string
    hours: number | null
    rate: number | null
    amount: number
    type: 'plan_fee' | 'support_overage' | 'dev_overage' | 'rush_fee' | 'credit'
  }>
  subtotal: number
  credits_applied: number
  total: number
}

// Partner client plan table row
export interface PartnerClientPlanRow {
  client_id: string
  client_name: string
  plan_assignment_id: string
  plan_name: string
  status: PlanStatus
  support_hours_used: number
  support_hours_included: number
  dev_hours_used: number
  dev_hours_included: number
  next_billing_date: string
  has_pending_overages: boolean
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert cents to formatted dollar string
 */
export function formatCentsToDollars(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

/**
 * Convert dollars to cents for storage
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Calculate remaining hours
 */
export function calculateRemainingHours(
  included: number,
  used: number
): number {
  return Math.max(0, included - used)
}

/**
 * Calculate overage hours
 */
export function calculateOverageHours(included: number, used: number): number {
  return Math.max(0, used - included)
}

/**
 * Check if plan is in a usable state (can submit requests)
 */
export function isPlanUsable(status: PlanStatus): boolean {
  return status === 'active'
}

/**
 * Check if plan allows requests (even in grace period, requests are blocked)
 */
export function canSubmitUnderPlan(status: PlanStatus): boolean {
  return status === 'active'
}

/**
 * Get human-readable status label
 */
export function getPlanStatusLabel(status: PlanStatus): string {
  const labels: Record<PlanStatus, string> = {
    pending: 'Pending Activation',
    active: 'Active',
    paused: 'Paused',
    grace_period: 'Grace Period',
    cancelled: 'Cancelled',
    expired: 'Expired',
  }
  return labels[status]
}

/**
 * Get status badge variant for UI
 */
export function getPlanStatusVariant(
  status: PlanStatus
): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  const variants: Record<
    PlanStatus,
    'default' | 'success' | 'warning' | 'destructive' | 'secondary'
  > = {
    pending: 'secondary',
    active: 'success',
    paused: 'warning',
    grace_period: 'warning',
    cancelled: 'destructive',
    expired: 'secondary',
  }
  return variants[status]
}
