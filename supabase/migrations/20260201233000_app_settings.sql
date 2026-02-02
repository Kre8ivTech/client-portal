-- Migration: App Settings for Integrations
-- Description: Storing global integration keys and settings
-- Date: 2026-02-01
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    stripe_mode TEXT DEFAULT 'test' CHECK (stripe_mode IN ('test', 'live')),
    stripe_live_secret_key TEXT,
    stripe_live_webhook_secret TEXT,
    stripe_test_secret_key TEXT,
    stripe_test_webhook_secret TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE
UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Row Level Security
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "App settings are readable by super_admin" ON app_settings;
CREATE POLICY "App settings are readable by super_admin" ON app_settings FOR
SELECT USING (is_super_admin());
DROP POLICY IF EXISTS "Only super_admin can update app settings" ON app_settings;
CREATE POLICY "Only super_admin can update app settings" ON app_settings FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
-- Insert default row
INSERT INTO app_settings (id, stripe_mode)
VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'test'
    ) ON CONFLICT (id) DO NOTHING;
COMMENT ON TABLE app_settings IS 'Global application settings for integrations, restricted to super_admin.';