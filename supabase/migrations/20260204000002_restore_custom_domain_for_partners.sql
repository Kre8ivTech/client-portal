-- Restore custom domain support for partner/tenant organizations (white-label)
-- Custom domains are used by white-label partners to serve the portal on their own domain

-- Add custom domain columns back to organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for custom domain lookups
CREATE INDEX IF NOT EXISTS idx_organizations_custom_domain
  ON organizations(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Add comment explaining the feature
COMMENT ON COLUMN organizations.custom_domain IS 'Custom domain for white-label partners (type=partner). Clients do not use custom domains.';
COMMENT ON COLUMN organizations.custom_domain_verified IS 'Whether the custom domain DNS has been verified.';
COMMENT ON COLUMN organizations.custom_domain_verified_at IS 'Timestamp when custom domain was verified.';
