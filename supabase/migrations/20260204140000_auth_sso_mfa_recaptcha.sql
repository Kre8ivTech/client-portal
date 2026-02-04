-- Migration: SSO, MFA, and reCAPTCHA settings
-- Description: Add columns to app_settings for authentication features

-- Add SSO provider settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS sso_google_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sso_microsoft_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sso_github_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sso_apple_enabled BOOLEAN DEFAULT false;

-- Add reCAPTCHA settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS recaptcha_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recaptcha_site_key TEXT,
ADD COLUMN IF NOT EXISTS recaptcha_secret_key TEXT;

-- Add MFA settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS mfa_required_for_staff BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_required_for_clients BOOLEAN DEFAULT false;

-- Comments
COMMENT ON COLUMN app_settings.sso_google_enabled IS 'Enable Google SSO login';
COMMENT ON COLUMN app_settings.sso_microsoft_enabled IS 'Enable Microsoft SSO login';
COMMENT ON COLUMN app_settings.sso_github_enabled IS 'Enable GitHub SSO login';
COMMENT ON COLUMN app_settings.sso_apple_enabled IS 'Enable Apple SSO login';
COMMENT ON COLUMN app_settings.recaptcha_enabled IS 'Enable reCAPTCHA on login/signup forms';
COMMENT ON COLUMN app_settings.recaptcha_site_key IS 'Google reCAPTCHA v3 site key (public)';
COMMENT ON COLUMN app_settings.recaptcha_secret_key IS 'Google reCAPTCHA v3 secret key (server-side only)';
COMMENT ON COLUMN app_settings.mfa_enabled IS 'Allow users to enable MFA on their accounts';
COMMENT ON COLUMN app_settings.mfa_required_for_staff IS 'Require MFA for staff and admin users';
COMMENT ON COLUMN app_settings.mfa_required_for_clients IS 'Require MFA for client users';

-- Add MFA status to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN users.mfa_enabled IS 'Whether user has MFA enabled';
COMMENT ON COLUMN users.mfa_verified_at IS 'When user last verified MFA';

-- Index for MFA queries
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled) WHERE mfa_enabled = true;
