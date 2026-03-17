-- Migration: Add salt column for secure encryption
-- Date: 2026-02-10
-- Priority: P0 (Critical Security Fix)
--
-- Context:
-- Previous encryption implementation used a static salt for all encrypted data.
-- This is a critical security vulnerability. Each encryption operation must use
-- a unique random salt to prevent rainbow table attacks.
--
-- Changes:
-- 1. Add salt column to app_settings for encrypted AWS S3 credentials
-- 2. Add check constraint to ensure salt is always present with encrypted data
-- 3. Add index for performance on encrypted fields query
--
-- Migration Strategy:
-- - Column is nullable to allow backward compatibility during migration
-- - After data migration, consider making column NOT NULL
-- - See docs/security-migration-guide.md for data migration steps

-- Add salt column to app_settings
ALTER TABLE app_settings
  ADD COLUMN aws_s3_config_salt TEXT;

COMMENT ON COLUMN app_settings.aws_s3_config_salt IS
  'Random salt used for AWS S3 credential encryption (32 bytes base64-encoded). ' ||
  'Must be stored alongside encrypted data for decryption. ' ||
  'Each encryption operation uses a unique salt for security.';

-- Add check constraint to ensure salt is present when encrypted data exists
-- This prevents storing encrypted data without its salt
ALTER TABLE app_settings
  ADD CONSTRAINT check_salt_with_encrypted_config
  CHECK (
    (aws_s3_config IS NULL AND aws_s3_config_salt IS NULL) OR
    (aws_s3_config IS NOT NULL AND aws_s3_config_salt IS NOT NULL)
  );

COMMENT ON CONSTRAINT check_salt_with_encrypted_config ON app_settings IS
  'Ensures salt is always stored with encrypted AWS S3 credentials. ' ||
  'Prevents decryption failures from missing salt.';

-- Add index for performance when querying organizations with encrypted credentials
CREATE INDEX idx_app_settings_encrypted_credentials
  ON app_settings(organization_id)
  WHERE aws_s3_config IS NOT NULL;

COMMENT ON INDEX idx_app_settings_encrypted_credentials IS
  'Performance index for querying organizations with encrypted AWS S3 credentials. ' ||
  'Used by admin panels and credential migration scripts.';

-- Add index for audit queries (find organizations with specific auth tag patterns)
CREATE INDEX idx_app_settings_auth_tag
  ON app_settings(aws_s3_config_auth_tag)
  WHERE aws_s3_config_auth_tag IS NOT NULL;

COMMENT ON INDEX idx_app_settings_auth_tag IS
  'Performance index for encrypted credential auditing and validation queries. ' ||
  'Used by security audit scripts.';

-- RLS Policies: No changes needed
-- Existing RLS policies on app_settings automatically apply to the new column:
-- - Users can view/edit app_settings for their organization
-- - Super admins can view/edit all app_settings
-- - Partners can view child organization settings (read-only)

-- Verification queries (run after migration):

-- Check that no encrypted data exists without salt (should return 0 rows)
-- SELECT organization_id, aws_s3_config
-- FROM app_settings
-- WHERE aws_s3_config IS NOT NULL
--   AND aws_s3_config_salt IS NULL;

-- Check that no salt exists without encrypted data (should return 0 rows)
-- SELECT organization_id, aws_s3_config_salt
-- FROM app_settings
-- WHERE aws_s3_config IS NULL
--   AND aws_s3_config_salt IS NOT NULL;

-- Count organizations with encrypted credentials
-- SELECT COUNT(*) as orgs_with_encrypted_credentials
-- FROM app_settings
-- WHERE aws_s3_config IS NOT NULL;
