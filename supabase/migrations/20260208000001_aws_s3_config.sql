-- Migration: AWS S3 Configuration
-- Created: 2026-02-08
-- Description: Add table to store AWS S3 credentials in admin settings,
--   allowing super_admins to configure S3 from the portal UI instead of
--   relying solely on environment variables.

-- ============================================================================
-- 1. Create aws_s3_config table
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_s3_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- AWS S3 Credentials
  aws_region TEXT NOT NULL DEFAULT 'us-east-1',
  access_key_id TEXT NOT NULL,
  secret_access_key TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  kms_key_id TEXT, -- optional: set to enable SSE-KMS instead of SSE-S3

  -- Optional: Organization-specific config (NULL = global / platform-wide config)
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  -- One config per org (or one global)
  UNIQUE(organization_id)
);

COMMENT ON TABLE aws_s3_config IS
  'Stores AWS S3 credentials. Global config (organization_id NULL) is the platform default. Per-org configs override the global one.';

-- ============================================================================
-- 2. RLS policies (super_admin only)
-- ============================================================================

ALTER TABLE aws_s3_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view S3 configs"
  ON aws_s3_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage S3 configs"
  ON aws_s3_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 3. Indexes and triggers
-- ============================================================================

CREATE INDEX idx_aws_s3_config_org ON aws_s3_config(organization_id);

CREATE TRIGGER update_aws_s3_config_updated_at
  BEFORE UPDATE ON aws_s3_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
