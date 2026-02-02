-- Invoice System Migration
-- Adds is_account_manager to users table
-- Creates invoices and invoice_line_items tables with proper RLS policies

-- ============================================================================
-- PART 1: Add is_account_manager column to users table
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_account_manager BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_account_manager IS
  'When true for staff role, grants access to invoice management. Non-account-manager staff cannot see invoices.';

-- Create helper function to check if user is account manager
CREATE OR REPLACE FUNCTION public.is_account_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR (role = 'staff' AND is_account_manager = true)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create helper function to check if user can view invoices (includes clients viewing their own)
CREATE OR REPLACE FUNCTION public.can_view_invoices()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR (role = 'staff' AND is_account_manager = true)
      OR role = 'partner'
      OR role = 'partner_staff'
      OR role = 'client'
    )
    AND NOT (role = 'staff' AND is_account_manager = false)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 2: Create invoice status enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM (
      'draft',
      'pending',
      'sent',
      'viewed',
      'partial',
      'paid',
      'overdue',
      'cancelled',
      'refunded'
    );
  END IF;
END $$;

-- ============================================================================
-- PART 3: Create invoices table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization and billing context
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_assignment_id UUID REFERENCES public.plan_assignments(id) ON DELETE SET NULL,

  -- Invoice identification
  invoice_number VARCHAR(50) NOT NULL,

  -- Status and dates
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Billing period (for recurring invoices)
  period_start DATE,
  period_end DATE,

  -- Financial amounts (stored in cents to avoid floating point issues)
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  discount_description VARCHAR(255),
  total INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  balance_due INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Payment details
  payment_terms_days INTEGER DEFAULT 30,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),

  -- Template and branding
  template_id UUID REFERENCES public.invoice_templates(id) ON DELETE SET NULL,

  -- Notes and metadata
  notes TEXT,
  internal_notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Audit fields
  created_by UUID NOT NULL REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT invoices_invoice_number_org_unique UNIQUE (organization_id, invoice_number),
  CONSTRAINT invoices_balance_check CHECK (balance_due >= 0),
  CONSTRAINT invoices_amounts_check CHECK (subtotal >= 0 AND tax_amount >= 0 AND total >= 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_invoices_organization ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_plan_assignment ON public.invoices(plan_assignment_id);

-- ============================================================================
-- PART 4: Create invoice_line_items table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,

  -- Line item details
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL, -- in cents
  amount INTEGER NOT NULL, -- quantity * unit_price

  -- Optional categorization
  item_type VARCHAR(50), -- e.g., 'plan_fee', 'support_hours', 'dev_hours', 'overage', 'custom'

  -- Reference to time entries or other billables
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);

-- ============================================================================
-- PART 5: Create invoice_payments table for tracking payment history
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,

  -- Payment details
  amount INTEGER NOT NULL, -- in cents
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Stripe integration
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),

  -- Notes
  notes TEXT,

  -- Audit
  recorded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

-- ============================================================================
-- PART 6: Enable RLS on all tables
-- ============================================================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 7: RLS Policies for invoices table
-- ============================================================================

-- Drop existing policies to make idempotent
DROP POLICY IF EXISTS "Admins and account managers can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view their org invoices" ON public.invoices;
DROP POLICY IF EXISTS "Partners can view client invoices" ON public.invoices;
DROP POLICY IF EXISTS "Account managers can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Account managers can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Super admins can delete invoices" ON public.invoices;

-- Super admins and account managers can view all invoices
CREATE POLICY "Admins and account managers can view all invoices"
  ON public.invoices FOR SELECT
  USING (is_account_manager());

-- Clients/partners can view their organization's invoices
CREATE POLICY "Users can view their org invoices"
  ON public.invoices FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND can_view_invoices()
  );

-- Partners can view their clients' invoices
CREATE POLICY "Partners can view client invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = invoices.organization_id
      AND o.parent_org_id = get_user_organization_id()
    )
    AND can_view_invoices()
  );

-- Only account managers can create invoices
CREATE POLICY "Account managers can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (is_account_manager());

-- Only account managers can update invoices
CREATE POLICY "Account managers can update invoices"
  ON public.invoices FOR UPDATE
  USING (is_account_manager())
  WITH CHECK (is_account_manager());

-- Only super admins can delete invoices (soft delete preferred in practice)
CREATE POLICY "Super admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (is_super_admin());

-- ============================================================================
-- PART 8: RLS Policies for invoice_line_items table
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view line items for accessible invoices" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Account managers can create line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Account managers can update line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Account managers can delete line items" ON public.invoice_line_items;

-- Line items inherit access from their parent invoice
CREATE POLICY "Users can view line items for accessible invoices"
  ON public.invoice_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND (
        is_account_manager()
        OR (i.organization_id = get_user_organization_id() AND can_view_invoices())
        OR EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = i.organization_id
          AND o.parent_org_id = get_user_organization_id()
          AND can_view_invoices()
        )
      )
    )
  );

-- Only account managers can create line items
CREATE POLICY "Account managers can create line items"
  ON public.invoice_line_items FOR INSERT
  WITH CHECK (is_account_manager());

-- Only account managers can update line items
CREATE POLICY "Account managers can update line items"
  ON public.invoice_line_items FOR UPDATE
  USING (is_account_manager())
  WITH CHECK (is_account_manager());

-- Only account managers can delete line items
CREATE POLICY "Account managers can delete line items"
  ON public.invoice_line_items FOR DELETE
  USING (is_account_manager());

-- ============================================================================
-- PART 9: RLS Policies for invoice_payments table
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view payments for accessible invoices" ON public.invoice_payments;
DROP POLICY IF EXISTS "Account managers can record payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Account managers can update payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Super admins can delete payments" ON public.invoice_payments;

-- Users can view payments for invoices they can access
CREATE POLICY "Users can view payments for accessible invoices"
  ON public.invoice_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
      AND (
        is_account_manager()
        OR (i.organization_id = get_user_organization_id() AND can_view_invoices())
        OR (
          can_view_invoices()
          AND EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = i.organization_id
            AND o.parent_org_id = get_user_organization_id()
          )
        )
      )
    )
  );

-- Only account managers can record payments
CREATE POLICY "Account managers can record payments"
  ON public.invoice_payments FOR INSERT
  WITH CHECK (is_account_manager());

-- Only account managers can update payments
CREATE POLICY "Account managers can update payments"
  ON public.invoice_payments FOR UPDATE
  USING (is_account_manager())
  WITH CHECK (is_account_manager());

-- Only super admins can delete payments
CREATE POLICY "Super admins can delete payments"
  ON public.invoice_payments FOR DELETE
  USING (is_super_admin());

-- ============================================================================
-- PART 10: Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS invoice_line_items_updated_at ON public.invoice_line_items;
CREATE TRIGGER invoice_line_items_updated_at
  BEFORE UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 11: Function to generate invoice number
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number(org_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  year_prefix VARCHAR(4);
  next_seq INTEGER;
  inv_number VARCHAR(50);
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get the next sequence number for this org this year
  SELECT COALESCE(MAX(
    CAST(
      NULLIF(REGEXP_REPLACE(invoice_number, '^INV-' || year_prefix || '-', ''), '')
      AS INTEGER
    )
  ), 0) + 1
  INTO next_seq
  FROM public.invoices
  WHERE organization_id = org_id
  AND invoice_number LIKE 'INV-' || year_prefix || '-%';

  inv_number := 'INV-' || year_prefix || '-' || LPAD(next_seq::TEXT, 5, '0');

  RETURN inv_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 12: Update user_profiles view to include is_account_manager
-- ============================================================================

DROP VIEW IF EXISTS public.user_profiles;

CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  u.id,
  u.email,
  u.role,
  u.status,
  u.organization_id,
  u.is_account_manager,
  u.created_at,
  u.updated_at,
  p.name,
  p.avatar_url,
  p.notification_preferences,
  p.presence_status,
  p.last_seen_at,
  o.name AS organization_name,
  o.slug AS organization_slug
FROM public.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.organizations o ON o.id = u.organization_id;

-- Recreate RLS for the view (views inherit from base tables)
-- Note: Since this is a view joining users and profiles, RLS on those tables applies
