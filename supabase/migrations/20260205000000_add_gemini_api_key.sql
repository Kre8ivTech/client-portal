-- Add Gemini API key column to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Add comment
COMMENT ON COLUMN app_settings.gemini_api_key IS 'Google Gemini API key for AI features';
