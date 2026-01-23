-- Migration: RLS Policies for Plans Tables
-- Description: Row-level security policies for multi-tenant plan access
-- Date: 2026-01-23

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_coverage_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_renewal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_hour_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE overage_acceptances ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get the current user's organization ID
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get the current user's organization type
CREATE OR REPLACE FUNCTION get_user_organization_type()
RETURNS TEXT AS $$
  SELECT o.type::text
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is Kre8ivTech (super admin)
CREATE OR REPLACE FUNCTION is_kre8ivtech_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid() AND o.type = 'kre8ivtech'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin or staff
CREATE OR REPLACE FUNCTION is_admin_or_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if org is a client of current user's partner org
CREATE OR REPLACE FUNCTION is_partner_client(client_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organizations o
    WHERE o.id = client_org_id
    AND o.parent_org_id = get_user_organization_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- INVOICE TEMPLATES POLICIES
-- =============================================================================

-- Kre8ivTech admins can manage all templates
CREATE POLICY "Kre8ivTech admins can manage all invoice templates"
  ON invoice_templates FOR ALL
  USING (is_kre8ivtech_user() AND is_admin_or_staff())
  WITH CHECK (is_kre8ivtech_user() AND is_admin_or_staff());

-- Partners can view and manage their own templates
CREATE POLICY "Partners can manage their own invoice templates"
  ON invoice_templates FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_admin_or_staff()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_admin_or_staff()
  );

-- Users can view their org's templates (read-only for non-admins)
CREATE POLICY "Users can view their org invoice templates"
  ON invoice_templates FOR SELECT
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- PLANS POLICIES
-- =============================================================================

-- Kre8ivTech admins have full access to all plans
CREATE POLICY "Kre8ivTech admins can manage all plans"
  ON plans FOR ALL
  USING (is_kre8ivtech_user() AND is_admin_or_staff())
  WITH CHECK (is_kre8ivtech_user() AND is_admin_or_staff());

-- Partners can manage their own plan templates
CREATE POLICY "Partners can manage their own plans"
  ON plans FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_admin_or_staff()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_admin_or_staff()
  );

-- Users can view system templates (org_id IS NULL) and their org's plans
CREATE POLICY "Users can view available plans"
  ON plans FOR SELECT
  USING (
    organization_id IS NULL  -- System templates
    OR organization_id = get_user_organization_id()  -- Own org's plans
  );

-- =============================================================================
-- PLAN COVERAGE ITEMS POLICIES
-- =============================================================================

-- Kre8ivTech admins can manage all coverage items
CREATE POLICY "Kre8ivTech admins can manage all plan coverage items"
  ON plan_coverage_items FOR ALL
  USING (is_kre8ivtech_user() AND is_admin_or_staff())
  WITH CHECK (is_kre8ivtech_user() AND is_admin_or_staff());

-- Partners can manage coverage items for their plans
CREATE POLICY "Partners can manage their plan coverage items"
  ON plan_coverage_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      WHERE p.id = plan_coverage_items.plan_id
      AND p.organization_id = get_user_organization_id()
    )
    AND is_admin_or_staff()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans p
      WHERE p.id = plan_coverage_items.plan_id
      AND p.organization_id = get_user_organization_id()
    )
    AND is_admin_or_staff()
  );

-- Users can view coverage items for plans they can see
CREATE POLICY "Users can view plan coverage items"
  ON plan_coverage_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      WHERE p.id = plan_coverage_items.plan_id
      AND (
        p.organization_id IS NULL  -- System templates
        OR p.organization_id = get_user_organization_id()
      )
    )
  );

-- =============================================================================
-- PLAN ASSIGNMENTS POLICIES
-- =============================================================================

-- Kre8ivTech admins can manage all assignments
CREATE POLICY "Kre8ivTech admins can manage all plan assignments"
  ON plan_assignments FOR ALL
  USING (is_kre8ivtech_user() AND is_admin_or_staff())
  WITH CHECK (is_kre8ivtech_user() AND is_admin_or_staff());

-- Partners can view assignments for their clients
CREATE POLICY "Partners can view their client plan assignments"
  ON plan_assignments FOR SELECT
  USING (
    organization_id = get_user_organization_id()  -- Own assignment
    OR is_partner_client(organization_id)         -- Client's assignment
    OR (partner_client_org_id IS NOT NULL AND is_partner_client(partner_client_org_id))
  );

-- Partners can manage their own assignments (request cancellation, etc.)
CREATE POLICY "Partners can update their plan assignments"
  ON plan_assignments FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND is_admin_or_staff()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_admin_or_staff()
  );

-- Direct clients can view their own assignments
CREATE POLICY "Clients can view their own plan assignments"
  ON plan_assignments FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Clients can request cancellation (limited update)
CREATE POLICY "Clients can request cancellation"
  ON plan_assignments FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    -- Only allow updating cancellation request fields
    -- Additional validation in application layer
  );

-- =============================================================================
-- BILLING DISPUTES POLICIES
-- =============================================================================

-- Kre8ivTech admins can manage all disputes
CREATE POLICY "Kre8ivTech admins can manage all billing disputes"
  ON billing_disputes FOR ALL
  USING (is_kre8ivtech_user() AND is_admin_or_staff())
  WITH CHECK (is_kre8ivtech_user() AND is_admin_or_staff());

-- Users can view disputes for their organization
CREATE POLICY "Users can view their org billing disputes"
  ON billing_disputes FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Users can create disputes for their organization
CREATE POLICY "Users can create billing disputes"
  ON billing_disputes FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND submitted_by = auth.uid()
  );

-- Users can update their own pending disputes (add info, withdraw)
CREATE POLICY "Users can update their pending disputes"
  ON billing_disputes FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND submitted_by = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND submitted_by = auth.uid()
    AND status = 'pending'
  );

-- Partners can view their clients' disputes
CREATE POLICY "Partners can view client billing disputes"
  ON billing_disputes FOR SELECT
  USING (is_partner_client(organization_id));

-- =============================================================================
-- PLAN RENEWAL NOTIFICATIONS POLICIES
-- =============================================================================

-- Kre8ivTech admins can manage all notifications
CREATE POLICY "Kre8ivTech admins can manage all renewal notifications"
  ON plan_renewal_notifications FOR ALL
  USING (is_kre8ivtech_user() AND is_admin_or_staff())
  WITH CHECK (is_kre8ivtech_user() AND is_admin_or_staff());

-- Users can view notifications for their plan assignments
CREATE POLICY "Users can view their renewal notifications"
  ON plan_renewal_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = plan_renewal_notifications.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
  );

-- Users can acknowledge notifications (update)
CREATE POLICY "Users can acknowledge renewal notifications"
  ON plan_renewal_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = plan_renewal_notifications.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = plan_renewal_notifications.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
  );

-- =============================================================================
-- PLAN HOUR LOGS POLICIES
-- =============================================================================

-- Kre8ivTech admins can manage all hour logs
CREATE POLICY "Kre8ivTech admins can manage all plan hour logs"
  ON plan_hour_logs FOR ALL
  USING (is_kre8ivtech_user() AND is_admin_or_staff())
  WITH CHECK (is_kre8ivtech_user() AND is_admin_or_staff());

-- Users can view hour logs for their plan assignments
CREATE POLICY "Users can view their plan hour logs"
  ON plan_hour_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = plan_hour_logs.plan_assignment_id
      AND (
        pa.organization_id = get_user_organization_id()
        OR is_partner_client(pa.organization_id)
      )
    )
  );

-- =============================================================================
-- OVERAGE ACCEPTANCES POLICIES
-- =============================================================================

-- Kre8ivTech admins can manage all overage acceptances
CREATE POLICY "Kre8ivTech admins can manage all overage acceptances"
  ON overage_acceptances FOR ALL
  USING (is_kre8ivtech_user() AND is_admin_or_staff())
  WITH CHECK (is_kre8ivtech_user() AND is_admin_or_staff());

-- Users can view overage requests for their plan assignments
CREATE POLICY "Users can view their overage acceptances"
  ON overage_acceptances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = overage_acceptances.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
  );

-- Users can accept/reject overage requests for their org
CREATE POLICY "Users can accept or reject overages"
  ON overage_acceptances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = overage_acceptances.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
    AND accepted IS NULL  -- Only pending acceptances
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = overage_acceptances.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
  );

-- Partners can view their clients' overage acceptances
CREATE POLICY "Partners can view client overage acceptances"
  ON overage_acceptances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = overage_acceptances.plan_assignment_id
      AND is_partner_client(pa.organization_id)
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION get_user_organization_id() IS 'Returns the organization_id for the currently authenticated user';
COMMENT ON FUNCTION get_user_organization_type() IS 'Returns the organization type (kre8ivtech, partner, client) for the current user';
COMMENT ON FUNCTION is_kre8ivtech_user() IS 'Returns true if current user belongs to Kre8ivTech organization';
COMMENT ON FUNCTION is_admin_or_staff() IS 'Returns true if current user has admin or staff role';
COMMENT ON FUNCTION is_partner_client(UUID) IS 'Returns true if the given org is a client of the current user partner org';
