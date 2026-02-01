-- Remove custom domain support from organizations table
-- This migration removes the custom_domain fields as the feature is not needed

-- Drop the index first
DROP INDEX IF EXISTS idx_organizations_custom_domain;

-- Remove custom domain columns
ALTER TABLE organizations
  DROP COLUMN IF EXISTS custom_domain,
  DROP COLUMN IF EXISTS custom_domain_verified,
  DROP COLUMN IF EXISTS custom_domain_verified_at;

-- Add comment explaining removal
COMMENT ON TABLE organizations IS 'Organization entities with branding and settings. Custom domain support removed as of 2026-02-01.';
