-- Migration: Partners can view client (child) organizations
-- Description: Allow partners to SELECT organizations where parent_org_id = their org
-- Date: 2026-01-31

-- Partners can view organizations that are their client orgs (child orgs)
CREATE POLICY "Partners can view client organizations"
  ON organizations FOR SELECT
  USING (
    parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
