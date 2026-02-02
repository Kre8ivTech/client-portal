-- Migration: Cron and SLA Settings
-- Description: Add admin-configurable settings for cron jobs and SLA monitoring
-- Date: 2026-02-02

-- =============================================================================
-- APP SETTINGS TABLE EXTENSION
-- =============================================================================

-- Check if app_settings table exists, if not create it
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(100),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage app settings
CREATE POLICY "Super admins can manage app settings"
ON app_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'super_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- Staff can view app settings
CREATE POLICY "Staff can view app settings"
ON app_settings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role IN ('staff', 'super_admin')
    )
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings(category);

-- Trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DEFAULT SLA MONITORING SETTINGS
-- =============================================================================

-- Insert default SLA monitoring settings
INSERT INTO app_settings (key, value, description, category) VALUES
(
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
),
(
    'sla_response_times',
    '{
        "standard": {
            "critical": {"first_response_hours": 1, "resolution_hours": 4},
            "high": {"first_response_hours": 4, "resolution_hours": 24},
            "medium": {"first_response_hours": 8, "resolution_hours": 48},
            "low": {"first_response_hours": 24, "resolution_hours": 72}
        },
        "priority_client_multiplier": 0.5
    }'::jsonb,
    'SLA response time targets by priority level',
    'monitoring'
),
(
    'notification_settings',
    '{
        "enabled": true,
        "rate_limit_per_ticket": 4,
        "rate_limit_window_hours": 24,
        "batch_notifications": false,
        "batch_delay_minutes": 15,
        "retry_failed": true,
        "retry_attempts": 3,
        "retry_delay_minutes": 5
    }'::jsonb,
    'Global notification system settings',
    'notifications'
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- FUNCTION: Get App Setting
-- =============================================================================

CREATE OR REPLACE FUNCTION get_app_setting(setting_key VARCHAR)
RETURNS JSONB AS $$
DECLARE
    setting_value JSONB;
BEGIN
    SELECT value INTO setting_value
    FROM app_settings
    WHERE key = setting_key;
    
    RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_app_setting IS 'Get application setting value by key';

-- =============================================================================
-- FUNCTION: Update App Setting
-- =============================================================================

CREATE OR REPLACE FUNCTION update_app_setting(
    setting_key VARCHAR,
    setting_value JSONB,
    user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE app_settings
    SET 
        value = setting_value,
        updated_by = COALESCE(user_id, auth.uid()),
        updated_at = NOW()
    WHERE key = setting_key;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_app_setting IS 'Update application setting value';
