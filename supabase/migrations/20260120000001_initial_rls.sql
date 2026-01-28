-- Migration: Base RLS Policies
-- Description: Security policies for organizations, profiles, and payment_terms
-- Date: 2026-01-20

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terms ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTIONS (If not already created)
-- =============================================================================

-- These may be duplicated in subsequent migrations, but we define them here
-- for the base tables. RLS policies expect these to exist.

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- ORGANIZATIONS POLICIES
-- =============================================================================

CREATE POLICY "Organizations are viewable by their members"
  ON organizations FOR SELECT
  USING (
    id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "Super admins can manage organizations"
  ON organizations FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =============================================================================
-- PROFILES POLICIES
-- =============================================================================

CREATE POLICY "Profiles are viewable by organization members"
  ON profiles FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "Users can update their own profiles"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Super admins can manage all profiles"
  ON profiles FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =============================================================================
-- PAYMENT TERMS POLICIES
-- =============================================================================

CREATE POLICY "Payment terms are viewable by organization members"
  ON payment_terms FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR organization_id IS NULL -- System defaults
    OR is_super_admin()
  );

CREATE POLICY "Super admins and staff can manage payment terms"
  ON payment_terms FOR ALL
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'staff'
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'staff'
    )
  );
