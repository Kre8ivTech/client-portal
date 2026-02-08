-- Migration: Store AWS S3 connection data encrypted in app_settings
-- Description: Adds columns for encrypted S3 config (region, bucket, access key, secret key, optional KMS).
-- Requires ENCRYPTION_SECRET env for encrypt/decrypt. Resolution order: app_settings (encrypted) -> aws_s3_config (legacy) -> env.
-- Date: 2026-02-09

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS aws_s3_config_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS aws_s3_config_iv TEXT,
  ADD COLUMN IF NOT EXISTS aws_s3_config_auth_tag TEXT;

COMMENT ON COLUMN app_settings.aws_s3_config_encrypted IS 'AES-256-GCM encrypted JSON: { aws_region, access_key_id, secret_access_key, bucket_name, kms_key_id }';
COMMENT ON COLUMN app_settings.aws_s3_config_iv IS 'IV for decrypting aws_s3_config_encrypted';
COMMENT ON COLUMN app_settings.aws_s3_config_auth_tag IS 'Auth tag for decrypting aws_s3_config_encrypted';
