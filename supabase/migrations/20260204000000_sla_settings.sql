-- Migration: SLA Settings Table
-- Description: Create a dedicated table for SLA and general app settings with key-value structure
-- Date: 2026-02-04

-- Create a new key-value settings table for SLA and other feature configurations
CREATE TABLE IF NOT EXISTS feature_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_feature_settings_updated_at ON feature_settings;
CREATE TRIGGER update_feature_settings_updated_at 
    BEFORE UPDATE ON feature_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE feature_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read feature settings
DROP POLICY IF EXISTS "Feature settings readable by admins" ON feature_settings;
CREATE POLICY "Feature settings readable by admins" ON feature_settings 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Only super_admin can modify feature settings
DROP POLICY IF EXISTS "Only super_admin can modify feature settings" ON feature_settings;
CREATE POLICY "Only super_admin can modify feature settings" ON feature_settings 
    FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Insert default SLA monitoring settings
INSERT INTO feature_settings (key, value, description, category)
VALUES (
    'sla_monitoring',
    '{
        "enabled": true,
        "cron_schedule": "0 8 * * *",
        "cron_enabled": true,
        "client_monitoring_enabled": true,
        "client_check_interval_minutes": 5,
        "notification_cooldown_hours": 4,
        "warning_threshold_percent": 25,
        "critical_threshold_hours": 2,
        "breach_immediate_notify": true,
        "auto_escalate_breaches": false,
        "escalation_delay_hours": 1
    }'::jsonb,
    'SLA monitoring and cron job configuration',
    'monitoring'
) ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE feature_settings IS 'Key-value store for feature configurations and settings';
