-- Add cloud drive OAuth configuration columns to app_settings
-- These store admin-configured OAuth app credentials for Google Drive, OneDrive, and Dropbox

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS google_drive_client_id text,
  ADD COLUMN IF NOT EXISTS google_drive_client_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS google_drive_client_secret_iv text,
  ADD COLUMN IF NOT EXISTS google_drive_client_secret_auth_tag text,
  ADD COLUMN IF NOT EXISTS onedrive_client_id text,
  ADD COLUMN IF NOT EXISTS onedrive_client_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS onedrive_client_secret_iv text,
  ADD COLUMN IF NOT EXISTS onedrive_client_secret_auth_tag text,
  ADD COLUMN IF NOT EXISTS onedrive_tenant_id text,
  ADD COLUMN IF NOT EXISTS dropbox_app_key text,
  ADD COLUMN IF NOT EXISTS dropbox_app_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS dropbox_app_secret_iv text,
  ADD COLUMN IF NOT EXISTS dropbox_app_secret_auth_tag text;
