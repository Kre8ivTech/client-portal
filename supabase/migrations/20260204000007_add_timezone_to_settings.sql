-- Add timezone to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

COMMENT ON COLUMN app_settings.timezone IS 'Global timezone for the application (e.g. America/New_York)';
