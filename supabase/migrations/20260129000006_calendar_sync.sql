-- Migration: Calendar Sync Integration
-- Description: Tables for syncing external calendars (Google, Microsoft Office 365)
-- Date: 2026-01-29

-- =============================================================================
-- CALENDAR CONNECTIONS (OAuth tokens for external calendars)
-- =============================================================================

CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Provider info
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('google', 'microsoft')),
    provider_account_id VARCHAR(255), -- External account identifier
    provider_email VARCHAR(255), -- Email associated with the calendar
    
    -- OAuth tokens (encrypted)
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Scopes granted
    scopes JSONB DEFAULT '[]',
    
    -- Sync settings
    sync_enabled BOOLEAN DEFAULT TRUE,
    sync_direction VARCHAR(20) DEFAULT 'import' 
        CHECK (sync_direction IN ('import', 'export', 'bidirectional')),
    
    -- Which calendars to sync (null = primary only)
    selected_calendars JSONB DEFAULT '[]',
    -- [{ "id": "cal_123", "name": "Work", "color": "#3B82F6", "sync": true }]
    
    -- What to sync
    sync_busy_only BOOLEAN DEFAULT TRUE, -- Only sync busy time, not details
    sync_all_day_events BOOLEAN DEFAULT TRUE,
    sync_private_events BOOLEAN DEFAULT FALSE,
    
    -- Lookahead/lookback
    sync_days_ahead INTEGER DEFAULT 30,
    sync_days_behind INTEGER DEFAULT 7,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'paused', 'error', 'expired', 'revoked')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20),
    last_sync_error TEXT,
    events_synced_count INTEGER DEFAULT 0,
    
    -- Metadata
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Only one connection per provider per user
    UNIQUE(profile_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_profile ON calendar_connections(profile_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_status ON calendar_connections(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_calendar_connections_sync ON calendar_connections(last_sync_at) WHERE sync_enabled = TRUE;

-- =============================================================================
-- CALENDAR SYNC LOG (Track sync operations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS calendar_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
    
    -- Sync details
    sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Results
    status VARCHAR(20) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    
    events_fetched INTEGER DEFAULT 0,
    events_created INTEGER DEFAULT 0,
    events_updated INTEGER DEFAULT 0,
    events_deleted INTEGER DEFAULT 0,
    
    -- Errors
    error_message TEXT,
    error_details JSONB,
    
    -- Sync token for incremental syncs (provider-specific)
    sync_token VARCHAR(500),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_connection ON calendar_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON calendar_sync_logs(status) WHERE status = 'running';

-- =============================================================================
-- UPDATE: Add external calendar fields to staff_calendar_blocks
-- =============================================================================

-- Add columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff_calendar_blocks' 
                   AND column_name = 'connection_id') THEN
        ALTER TABLE staff_calendar_blocks 
            ADD COLUMN connection_id UUID REFERENCES calendar_connections(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff_calendar_blocks' 
                   AND column_name = 'external_event_uid') THEN
        ALTER TABLE staff_calendar_blocks 
            ADD COLUMN external_event_uid VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff_calendar_blocks' 
                   AND column_name = 'external_calendar_name') THEN
        ALTER TABLE staff_calendar_blocks 
            ADD COLUMN external_calendar_name VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff_calendar_blocks' 
                   AND column_name = 'is_synced') THEN
        ALTER TABLE staff_calendar_blocks 
            ADD COLUMN is_synced BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff_calendar_blocks' 
                   AND column_name = 'sync_source') THEN
        ALTER TABLE staff_calendar_blocks 
            ADD COLUMN sync_source VARCHAR(30);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff_calendar_blocks' 
                   AND column_name = 'last_synced_at') THEN
        ALTER TABLE staff_calendar_blocks 
            ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Index for finding synced events
CREATE INDEX IF NOT EXISTS idx_calendar_blocks_synced 
    ON staff_calendar_blocks(connection_id, external_event_uid) 
    WHERE is_synced = TRUE;

-- =============================================================================
-- WEBHOOK SUBSCRIPTIONS (For real-time calendar updates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS calendar_webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
    
    -- Subscription info
    provider VARCHAR(30) NOT NULL,
    subscription_id VARCHAR(500) NOT NULL,
    resource_id VARCHAR(500),
    channel_id VARCHAR(500),
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(connection_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_expiry 
    ON calendar_webhook_subscriptions(expires_at) 
    WHERE is_active = TRUE;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own calendar connections
CREATE POLICY "Users can manage own calendar connections"
    ON calendar_connections FOR ALL
    USING (profile_id = auth.uid());

-- Users can view their own sync logs
CREATE POLICY "Users can view own sync logs"
    ON calendar_sync_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM calendar_connections cc
            WHERE cc.id = calendar_sync_logs.connection_id
            AND cc.profile_id = auth.uid()
        )
    );

-- Admins can view all connections for troubleshooting
CREATE POLICY "Admins can view all calendar connections"
    ON calendar_connections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- =============================================================================
-- FUNCTIONS: Calendar sync helpers
-- =============================================================================

-- Function to get active connections needing sync
CREATE OR REPLACE FUNCTION get_connections_needing_sync(
    p_sync_interval_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
    connection_id UUID,
    profile_id UUID,
    provider VARCHAR(30),
    last_sync_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cc.id as connection_id,
        cc.profile_id,
        cc.provider,
        cc.last_sync_at
    FROM calendar_connections cc
    WHERE cc.sync_enabled = TRUE
      AND cc.status = 'active'
      AND (
          cc.last_sync_at IS NULL 
          OR cc.last_sync_at < NOW() - (p_sync_interval_minutes || ' minutes')::interval
      )
    ORDER BY cc.last_sync_at NULLS FIRST
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert calendar block from sync
CREATE OR REPLACE FUNCTION upsert_synced_calendar_block(
    p_profile_id UUID,
    p_connection_id UUID,
    p_external_event_uid VARCHAR(500),
    p_block_type VARCHAR(30),
    p_title VARCHAR(255),
    p_description TEXT,
    p_start_at TIMESTAMP WITH TIME ZONE,
    p_end_at TIMESTAMP WITH TIME ZONE,
    p_all_day BOOLEAN,
    p_sync_source VARCHAR(30),
    p_external_calendar_name VARCHAR(255)
)
RETURNS UUID AS $$
DECLARE
    v_block_id UUID;
BEGIN
    -- Try to find existing block
    SELECT id INTO v_block_id
    FROM staff_calendar_blocks
    WHERE connection_id = p_connection_id
      AND external_event_uid = p_external_event_uid;
    
    IF v_block_id IS NOT NULL THEN
        -- Update existing
        UPDATE staff_calendar_blocks SET
            title = p_title,
            description = p_description,
            start_at = p_start_at,
            end_at = p_end_at,
            all_day = p_all_day,
            last_synced_at = NOW(),
            updated_at = NOW()
        WHERE id = v_block_id;
    ELSE
        -- Insert new
        INSERT INTO staff_calendar_blocks (
            profile_id, connection_id, external_event_uid,
            block_type, title, description,
            start_at, end_at, all_day,
            is_synced, sync_source, external_calendar_name,
            last_synced_at
        ) VALUES (
            p_profile_id, p_connection_id, p_external_event_uid,
            p_block_type, p_title, p_description,
            p_start_at, p_end_at, p_all_day,
            TRUE, p_sync_source, p_external_calendar_name,
            NOW()
        )
        RETURNING id INTO v_block_id;
    END IF;
    
    RETURN v_block_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup orphaned synced events (deleted from source)
CREATE OR REPLACE FUNCTION cleanup_orphaned_synced_events(
    p_connection_id UUID,
    p_valid_event_uids VARCHAR(500)[]
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM staff_calendar_blocks
    WHERE connection_id = p_connection_id
      AND is_synced = TRUE
      AND external_event_uid IS NOT NULL
      AND NOT (external_event_uid = ANY(p_valid_event_uids));
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;
