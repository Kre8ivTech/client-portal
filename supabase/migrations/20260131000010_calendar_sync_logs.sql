-- Migration: Calendar sync logs
-- Description: Track calendar sync history per integration
-- Date: 2026-01-31

CREATE TABLE IF NOT EXISTS calendar_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'error')),
    message TEXT,
    calendars_synced INTEGER DEFAULT 0,
    events_synced INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_integration ON calendar_sync_logs(integration_id, started_at);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_org ON calendar_sync_logs(organization_id, started_at);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_user ON calendar_sync_logs(user_id, started_at);

ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sync logs"
ON calendar_sync_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can view org sync logs"
ON calendar_sync_logs FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);
