-- Migration: QuickBooks App Configuration
-- Created: 2026-02-04
-- Description: Add table to store QuickBooks app credentials in admin settings

-- ============================================================================
-- 1. Create quickbooks_app_config table
-- ============================================================================

CREATE TABLE IF NOT EXISTS quickbooks_app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- QuickBooks OAuth App Credentials
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL, -- Should be encrypted at application level
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),

  -- Optional: Organization-specific config (NULL = global config)
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  -- Ensure only one config per organization (or one global config)
  UNIQUE(organization_id)
);

-- Add comment
COMMENT ON TABLE quickbooks_app_config IS
  'Stores QuickBooks OAuth app credentials. Can be global (organization_id NULL) or per-organization.';

-- ============================================================================
-- 2. Add RLS policies
-- ============================================================================

ALTER TABLE quickbooks_app_config ENABLE ROW LEVEL SECURITY;

-- Super admins can view all configs
CREATE POLICY "Super admins can view QB app configs"
  ON quickbooks_app_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can manage all configs
CREATE POLICY "Super admins can manage QB app configs"
  ON quickbooks_app_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Add indexes
CREATE INDEX idx_qb_app_config_org ON quickbooks_app_config(organization_id);

-- Add trigger for updated_at
CREATE TRIGGER update_quickbooks_app_config_updated_at
  BEFORE UPDATE ON quickbooks_app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Function to get QB config (fallback to global if org-specific not found)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_quickbooks_app_config(p_organization_id UUID DEFAULT NULL)
RETURNS TABLE (
  client_id TEXT,
  client_secret TEXT,
  environment TEXT
) AS $$
BEGIN
  -- First try to get organization-specific config
  IF p_organization_id IS NOT NULL THEN
    RETURN QUERY
    SELECT qac.client_id, qac.client_secret, qac.environment
    FROM quickbooks_app_config qac
    WHERE qac.organization_id = p_organization_id;

    -- If found, return
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Fall back to global config
  RETURN QUERY
  SELECT qac.client_id, qac.client_secret, qac.environment
  FROM quickbooks_app_config qac
  WHERE qac.organization_id IS NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION get_quickbooks_app_config IS
  'Gets QuickBooks app config for an organization, falling back to global config if not found.';

-- Grant execute
GRANT EXECUTE ON FUNCTION get_quickbooks_app_config TO authenticated;
