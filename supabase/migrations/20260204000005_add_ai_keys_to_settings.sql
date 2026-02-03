-- Add AI keys to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ai_provider_primary TEXT DEFAULT 'openrouter',
ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT,
ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT,
ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

COMMENT ON COLUMN app_settings.ai_provider_primary IS 'Primary AI provider: openrouter, anthropic, or openai';
