-- Migration: Create Plans Configuration Tables
-- Description: Tables for plan templates, assignments, coverage items, invoice templates, and billing disputes
-- Date: 2026-01-23

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

-- Plan status for assignments/subscriptions
CREATE TYPE plan_status AS ENUM (
  'pending',      -- Plan created but not yet active
  'active',       -- Plan is currently active
  'paused',       -- Plan temporarily paused (admin action)
  'grace_period', -- Payment failed, in grace period
  'cancelled',    -- Plan has been cancelled
  'expired'       -- Plan ended naturally (if not auto-renewing)
);

-- Coverage type for plan items
CREATE TYPE coverage_type AS ENUM (
  'support',  -- General support: troubleshooting, updates, bug fixes
  'dev',      -- Development: new features, custom work
  'both'      -- Covered under both categories
);

-- Billing dispute status
CREATE TYPE dispute_status AS ENUM (
  'pending',      -- Just submitted
  'under_review', -- Being reviewed by staff/admin
  'resolved',     -- Issue resolved
  'rejected'      -- Dispute rejected with explanation
);

-- Billing dispute type
CREATE TYPE dispute_type AS ENUM (
  'time_logged',     -- Dispute about hours logged
  'invoice_amount',  -- Dispute about invoice total
  'coverage',        -- Dispute about what's covered
  'other'            -- Other billing issue
);

-- =============================================================================
-- INVOICE TEMPLATES TABLE
-- =============================================================================

CREATE TABLE invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Template identification
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Template content
  header_text TEXT,
  footer_text TEXT,
  terms_text TEXT,

  -- Display options
  line_item_format JSONB DEFAULT '{
    "show_date": true,
    "show_description": true,
    "show_hours": true,
    "show_rate": true,
    "show_amount": true,
    "group_by_type": true
  }'::jsonb,
  show_hours_breakdown BOOLEAN DEFAULT true,
  show_rate_details BOOLEAN DEFAULT true,
  show_plan_summary BOOLEAN DEFAULT true,

  -- Branding
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#000000',
  accent_color VARCHAR(7) DEFAULT '#666666',

  -- Settings
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT invoice_templates_name_org_unique UNIQUE (organization_id, name)
);

-- Index for quick lookups
CREATE INDEX idx_invoice_templates_org ON invoice_templates(organization_id);
CREATE INDEX idx_invoice_templates_default ON invoice_templates(organization_id, is_default) WHERE is_default = true;

-- =============================================================================
-- PLANS TABLE (Plan Templates/Definitions)
-- =============================================================================

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization that created this plan (NULL = system-wide template)
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Plan identification
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Hours allocation (separate pools)
  support_hours_included INTEGER NOT NULL DEFAULT 0,
  dev_hours_included INTEGER NOT NULL DEFAULT 0,

  -- Hourly rates for overages (stored in cents to avoid floating point issues)
  support_hourly_rate INTEGER NOT NULL DEFAULT 0,  -- e.g., 12500 = $125.00
  dev_hourly_rate INTEGER NOT NULL DEFAULT 0,      -- e.g., 15000 = $150.00

  -- Monthly fee (stored in cents)
  monthly_fee INTEGER NOT NULL DEFAULT 0,          -- e.g., 50000 = $500.00
  currency VARCHAR(3) DEFAULT 'USD',

  -- Billing configuration
  payment_terms_days INTEGER DEFAULT 30,           -- Days client has to pay invoice
  auto_send_invoices BOOLEAN DEFAULT false,        -- Auto-send or draft for review
  invoice_template_id UUID REFERENCES invoice_templates(id) ON DELETE SET NULL,

  -- Rush support configuration
  rush_support_included BOOLEAN DEFAULT false,
  rush_support_fee INTEGER DEFAULT 0,              -- Additional fee for rush if not included
  rush_priority_boost INTEGER DEFAULT 5,           -- How many positions to move up in queue

  -- Plan metadata
  is_template BOOLEAN DEFAULT true,                -- true = reusable template, false = custom one-off
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT plans_name_org_unique UNIQUE (organization_id, name),
  CONSTRAINT plans_hours_non_negative CHECK (support_hours_included >= 0 AND dev_hours_included >= 0),
  CONSTRAINT plans_rates_non_negative CHECK (support_hourly_rate >= 0 AND dev_hourly_rate >= 0),
  CONSTRAINT plans_fee_non_negative CHECK (monthly_fee >= 0),
  CONSTRAINT plans_payment_terms_valid CHECK (payment_terms_days > 0 AND payment_terms_days <= 365)
);

-- Indexes for common queries
CREATE INDEX idx_plans_org ON plans(organization_id);
CREATE INDEX idx_plans_active ON plans(is_active) WHERE is_active = true;
CREATE INDEX idx_plans_templates ON plans(is_template, is_active) WHERE is_template = true AND is_active = true;

-- =============================================================================
-- PLAN COVERAGE ITEMS TABLE
-- =============================================================================

CREATE TABLE plan_coverage_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,

  -- Coverage definition
  name VARCHAR(255) NOT NULL,
  description TEXT,
  coverage_type coverage_type NOT NULL DEFAULT 'support',

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT plan_coverage_items_name_plan_unique UNIQUE (plan_id, name)
);

-- Index for quick lookups
CREATE INDEX idx_plan_coverage_items_plan ON plan_coverage_items(plan_id);
CREATE INDEX idx_plan_coverage_items_type ON plan_coverage_items(plan_id, coverage_type);

-- =============================================================================
-- PLAN ASSIGNMENTS TABLE (Subscriptions)
-- =============================================================================

CREATE TABLE plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan reference
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,

  -- Client organization that has this plan
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- For partner clients: which specific client org under the partner
  -- NULL for direct clients, populated for partner's clients
  partner_client_org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Billing cycle
  start_date DATE NOT NULL,
  next_billing_date DATE NOT NULL,
  billing_cycle_day INTEGER NOT NULL CHECK (billing_cycle_day >= 1 AND billing_cycle_day <= 28),

  -- Status
  status plan_status DEFAULT 'pending' NOT NULL,
  auto_renew BOOLEAN DEFAULT true,

  -- Current period hour tracking (resets each billing cycle)
  support_hours_used NUMERIC(10, 2) DEFAULT 0,
  dev_hours_used NUMERIC(10, 2) DEFAULT 0,
  last_hours_reset_date DATE,

  -- Grace period tracking
  grace_period_start DATE,
  grace_period_end DATE,
  failed_payment_count INTEGER DEFAULT 0,
  last_payment_attempt TIMESTAMPTZ,

  -- Cancellation tracking
  cancellation_requested_at TIMESTAMPTZ,
  cancellation_requested_by UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),

  -- Proration tracking
  proration_credit INTEGER DEFAULT 0,  -- Credit in cents for mid-cycle changes

  -- Contract/Agreement link (plan = contract)
  contract_id UUID, -- Will reference contracts table when it exists

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT plan_assignments_hours_non_negative CHECK (support_hours_used >= 0 AND dev_hours_used >= 0),
  CONSTRAINT plan_assignments_grace_period_valid CHECK (
    (grace_period_start IS NULL AND grace_period_end IS NULL) OR
    (grace_period_start IS NOT NULL AND grace_period_end IS NOT NULL AND grace_period_end > grace_period_start)
  )
);

-- Indexes for common queries
CREATE INDEX idx_plan_assignments_org ON plan_assignments(organization_id);
CREATE INDEX idx_plan_assignments_plan ON plan_assignments(plan_id);
CREATE INDEX idx_plan_assignments_status ON plan_assignments(status);
CREATE INDEX idx_plan_assignments_partner_client ON plan_assignments(partner_client_org_id) WHERE partner_client_org_id IS NOT NULL;
CREATE INDEX idx_plan_assignments_next_billing ON plan_assignments(next_billing_date) WHERE status = 'active';
CREATE INDEX idx_plan_assignments_grace ON plan_assignments(grace_period_end) WHERE status = 'grace_period';

-- Unique constraint: Direct clients can only have one active plan
-- Partners' clients are tracked via partner_client_org_id
CREATE UNIQUE INDEX idx_plan_assignments_single_active_direct
  ON plan_assignments(organization_id)
  WHERE status IN ('pending', 'active', 'grace_period') AND partner_client_org_id IS NULL;

-- =============================================================================
-- BILLING DISPUTES TABLE
-- =============================================================================

CREATE TABLE billing_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Who submitted
  submitted_by UUID NOT NULL REFERENCES profiles(id),

  -- Related records (at least one should be populated)
  invoice_id UUID, -- Will reference invoices table
  plan_assignment_id UUID REFERENCES plan_assignments(id) ON DELETE SET NULL,
  ticket_id UUID,  -- Will reference tickets table
  time_entry_id UUID, -- Will reference time_entries table

  -- Dispute details
  dispute_type dispute_type NOT NULL,
  description TEXT NOT NULL,
  supporting_documents JSONB DEFAULT '[]'::jsonb, -- Array of file URLs

  -- Resolution
  status dispute_status DEFAULT 'pending' NOT NULL,
  resolution TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,

  -- Credit/Adjustment
  credit_amount INTEGER DEFAULT 0, -- Amount credited in cents
  credit_applied_to_invoice_id UUID, -- Invoice where credit was applied

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_billing_disputes_org ON billing_disputes(organization_id);
CREATE INDEX idx_billing_disputes_submitted_by ON billing_disputes(submitted_by);
CREATE INDEX idx_billing_disputes_status ON billing_disputes(status);
CREATE INDEX idx_billing_disputes_plan ON billing_disputes(plan_assignment_id) WHERE plan_assignment_id IS NOT NULL;

-- =============================================================================
-- PLAN RENEWAL NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE plan_renewal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_assignment_id UUID NOT NULL REFERENCES plan_assignments(id) ON DELETE CASCADE,

  -- Notification timing
  days_before_renewal INTEGER NOT NULL, -- 1, 5, 15, or 30 days
  scheduled_for TIMESTAMPTZ NOT NULL,

  -- Status
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT plan_renewal_notifications_days_valid CHECK (days_before_renewal IN (1, 5, 15, 30))
);

-- Indexes
CREATE INDEX idx_plan_renewal_notifications_assignment ON plan_renewal_notifications(plan_assignment_id);
CREATE INDEX idx_plan_renewal_notifications_scheduled ON plan_renewal_notifications(scheduled_for) WHERE sent_at IS NULL;

-- =============================================================================
-- PLAN HOUR LOGS TABLE (Track hour usage per period)
-- =============================================================================

CREATE TABLE plan_hour_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_assignment_id UUID NOT NULL REFERENCES plan_assignments(id) ON DELETE CASCADE,

  -- Period tracking
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Hours used during this period
  support_hours_used NUMERIC(10, 2) DEFAULT 0,
  dev_hours_used NUMERIC(10, 2) DEFAULT 0,

  -- Overage tracking
  support_overage_hours NUMERIC(10, 2) DEFAULT 0,
  dev_overage_hours NUMERIC(10, 2) DEFAULT 0,
  overage_invoice_id UUID, -- Invoice generated for overages

  -- Status
  is_current_period BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT plan_hour_logs_period_valid CHECK (period_end > period_start),
  CONSTRAINT plan_hour_logs_hours_non_negative CHECK (
    support_hours_used >= 0 AND
    dev_hours_used >= 0 AND
    support_overage_hours >= 0 AND
    dev_overage_hours >= 0
  )
);

-- Indexes
CREATE INDEX idx_plan_hour_logs_assignment ON plan_hour_logs(plan_assignment_id);
CREATE INDEX idx_plan_hour_logs_current ON plan_hour_logs(plan_assignment_id, is_current_period) WHERE is_current_period = true;
CREATE INDEX idx_plan_hour_logs_period ON plan_hour_logs(plan_assignment_id, period_start, period_end);

-- =============================================================================
-- OVERAGE ACCEPTANCES TABLE (Client must accept overages before work proceeds)
-- =============================================================================

CREATE TABLE overage_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_assignment_id UUID NOT NULL REFERENCES plan_assignments(id) ON DELETE CASCADE,

  -- Who requested and when
  requested_by UUID NOT NULL REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Overage details
  overage_type coverage_type NOT NULL, -- support or dev
  estimated_hours NUMERIC(10, 2) NOT NULL,
  hourly_rate INTEGER NOT NULL, -- Rate in cents
  estimated_total INTEGER NOT NULL, -- Estimated cost in cents

  -- Related ticket (if applicable)
  ticket_id UUID, -- Will reference tickets table
  description TEXT,

  -- Acceptance status
  accepted BOOLEAN,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  -- Invoice generated after acceptance
  invoice_id UUID, -- Will reference invoices table
  invoice_approved BOOLEAN DEFAULT false,
  invoice_approved_at TIMESTAMPTZ,
  invoice_approved_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_overage_acceptances_assignment ON overage_acceptances(plan_assignment_id);
CREATE INDEX idx_overage_acceptances_pending ON overage_acceptances(plan_assignment_id, accepted) WHERE accepted IS NULL;
CREATE INDEX idx_overage_acceptances_ticket ON overage_acceptances(ticket_id) WHERE ticket_id IS NOT NULL;

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_invoice_templates_updated_at
  BEFORE UPDATE ON invoice_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_coverage_items_updated_at
  BEFORE UPDATE ON plan_coverage_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_assignments_updated_at
  BEFORE UPDATE ON plan_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_disputes_updated_at
  BEFORE UPDATE ON billing_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_hour_logs_updated_at
  BEFORE UPDATE ON plan_hour_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_overage_acceptances_updated_at
  BEFORE UPDATE ON overage_acceptances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE plans IS 'Plan templates/definitions with pricing, hours, and configuration';
COMMENT ON TABLE plan_coverage_items IS 'Items covered under each plan (support types, dev work types)';
COMMENT ON TABLE plan_assignments IS 'Active plan subscriptions linking plans to client organizations';
COMMENT ON TABLE invoice_templates IS 'Customizable invoice templates for branding and formatting';
COMMENT ON TABLE billing_disputes IS 'Client-submitted billing disputes for time, invoices, or coverage';
COMMENT ON TABLE plan_renewal_notifications IS 'Scheduled renewal reminders (1, 5, 15, 30 days before)';
COMMENT ON TABLE plan_hour_logs IS 'Historical record of hours used per billing period';
COMMENT ON TABLE overage_acceptances IS 'Client acceptance workflow for overage charges';

COMMENT ON COLUMN plans.support_hourly_rate IS 'Rate in cents (e.g., 12500 = $125.00)';
COMMENT ON COLUMN plans.dev_hourly_rate IS 'Rate in cents (e.g., 15000 = $150.00)';
COMMENT ON COLUMN plans.monthly_fee IS 'Monthly plan fee in cents (e.g., 50000 = $500.00)';
COMMENT ON COLUMN plan_assignments.partner_client_org_id IS 'For partner clients: the specific client org. NULL for direct clients.';
COMMENT ON COLUMN plan_assignments.billing_cycle_day IS 'Day of month for billing (1-28 to ensure valid for all months)';
