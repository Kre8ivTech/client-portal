-- Migration: Add UPDATE policy for organizations table
-- Description: Allow partners to update their own organization branding and settings
-- Issue: Partners could not update their organization branding from white-label settings page
--        because there was no RLS UPDATE policy for the organizations table.
-- Date: 2026-02-03

-- =============================================================================
-- ADD UPDATE POLICY FOR ORGANIZATIONS
-- =============================================================================

-- Allow super admins and staff to update any organization
DROP POLICY IF EXISTS "Super admins and staff can update organizations" ON organizations;
CREATE POLICY "Super admins and staff can update organizations"
  ON organizations FOR UPDATE
  USING (is_super_admin() OR is_admin_or_staff())
  WITH CHECK (is_super_admin() OR is_admin_or_staff());

-- Allow partners to update their own organization
DROP POLICY IF EXISTS "Partners can update own organization" ON organizations;
CREATE POLICY "Partners can update own organization"
  ON organizations FOR UPDATE
  USING (
    id = get_user_organization_id()
    AND get_user_role() IN ('partner', 'partner_staff')
  )
  WITH CHECK (
    id = get_user_organization_id()
    AND get_user_role() IN ('partner', 'partner_staff')
  );

-- Allow partners to update their client organizations
DROP POLICY IF EXISTS "Partners can update client organizations" ON organizations;
CREATE POLICY "Partners can update client organizations"
  ON organizations FOR UPDATE
  USING (
    parent_org_id = get_user_organization_id()
    AND get_user_role() IN ('partner', 'partner_staff')
  )
  WITH CHECK (
    parent_org_id = get_user_organization_id()
    AND get_user_role() IN ('partner', 'partner_staff')
  );
