-- Migration: Ticket Notifications and Priority Clients
-- Description: Add notification system, priority client flags, and enhanced SLA tracking
-- Date: 2026-02-02

-- =============================================================================
-- ORGANIZATIONS: Add Priority Client Flag
-- =============================================================================

-- Add priority client flag to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_priority_client BOOLEAN DEFAULT FALSE;

-- Add notification preferences to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email": true,
  "sms": false,
  "slack": false,
  "whatsapp": false,
  "slack_webhook_url": null,
  "whatsapp_number": null,
  "sms_number": null,
  "notify_on_ticket_created": true,
  "notify_on_ticket_updated": true,
  "notify_on_ticket_comment": true,
  "notify_on_ticket_assigned": true,
  "notify_on_ticket_resolved": true
}'::jsonb;

COMMENT ON COLUMN organizations.is_priority_client IS 'Priority clients get faster SLA response times (50% reduction)';
COMMENT ON COLUMN organizations.notification_preferences IS 'Organization-wide notification channel preferences';

-- =============================================================================
-- USERS: Add Notification Preferences
-- =============================================================================

-- Add notification preferences to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email": true,
  "sms": false,
  "slack": false,
  "whatsapp": false,
  "sms_number": null,
  "notify_on_ticket_created": true,
  "notify_on_ticket_updated": true,
  "notify_on_ticket_comment": true,
  "notify_on_ticket_assigned": true,
  "notify_on_ticket_resolved": true,
  "notify_on_sla_warning": true,
  "notify_on_sla_breach": true
}'::jsonb;

COMMENT ON COLUMN users.notification_preferences IS 'User-specific notification preferences (overrides org defaults)';

-- =============================================================================
-- NOTIFICATION LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'ticket_created', 'ticket_updated', 'ticket_comment', 
        'ticket_assigned', 'ticket_resolved', 'ticket_closed',
        'sla_warning', 'sla_breach'
    )),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'slack', 'whatsapp')),
    
    -- Related entities
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES ticket_comments(id) ON DELETE SET NULL,
    
    -- Message content
    subject VARCHAR(500),
    message TEXT NOT NULL,
    recipient VARCHAR(255) NOT NULL, -- email, phone number, or webhook URL
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    sent_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Provider info
    provider VARCHAR(50), -- resend, twilio, slack, etc.
    provider_message_id VARCHAR(255),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notification log
CREATE INDEX IF NOT EXISTS idx_notification_log_org ON notification_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_ticket ON notification_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_type_status ON notification_log(notification_type, status);

COMMENT ON TABLE notification_log IS 'Audit log of all notifications sent through the system';

-- =============================================================================
-- ENABLE RLS ON NOTIFICATION LOG
-- =============================================================================

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Staff and super admins can view all notification logs
CREATE POLICY "Staff can view all notification logs"
ON notification_log FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('staff', 'super_admin')
    )
);

-- Users can view their own notification logs
CREATE POLICY "Users can view own notification logs"
ON notification_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only staff can insert notification logs (through backend)
CREATE POLICY "Staff can insert notification logs"
ON notification_log FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('staff', 'super_admin')
    )
);

-- =============================================================================
-- ENHANCED SLA CALCULATION WITH PRIORITY CLIENTS
-- =============================================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS calculate_ticket_sla_on_insert ON tickets;
DROP TRIGGER IF EXISTS recalculate_ticket_sla_on_priority_update ON tickets;

-- Enhanced function to calculate SLA with priority client support
CREATE OR REPLACE FUNCTION calculate_ticket_sla_dates_with_priority_client()
RETURNS TRIGGER AS $$
DECLARE
    first_response_hours INT;
    resolution_hours INT;
    is_priority BOOLEAN;
BEGIN
    -- Only calculate if sla_due_at or first_response_due_at are not already set
    IF NEW.sla_due_at IS NULL OR NEW.first_response_due_at IS NULL THEN
        -- Check if this is a priority client
        SELECT COALESCE(is_priority_client, FALSE) INTO is_priority
        FROM organizations
        WHERE id = NEW.organization_id;
        
        -- Get base response times based on priority
        CASE NEW.priority
            WHEN 'critical' THEN
                first_response_hours := 1;
                resolution_hours := 4;
            WHEN 'high' THEN
                first_response_hours := 4;
                resolution_hours := 24;
            WHEN 'medium' THEN
                first_response_hours := 8;
                resolution_hours := 48;
            WHEN 'low' THEN
                first_response_hours := 24;
                resolution_hours := 72;
            ELSE
                first_response_hours := 8;
                resolution_hours := 48;
        END CASE;
        
        -- Reduce response times by 50% for priority clients
        IF is_priority THEN
            first_response_hours := GREATEST(1, first_response_hours / 2);
            resolution_hours := GREATEST(2, resolution_hours / 2);
        END IF;

        -- Set first response due if not already set
        IF NEW.first_response_due_at IS NULL THEN
            NEW.first_response_due_at := COALESCE(NEW.created_at, NOW()) + (first_response_hours || ' hours')::INTERVAL;
        END IF;

        -- Set SLA due date if not already set
        IF NEW.sla_due_at IS NULL THEN
            NEW.sla_due_at := COALESCE(NEW.created_at, NOW()) + (resolution_hours || ' hours')::INTERVAL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new tickets
CREATE TRIGGER calculate_ticket_sla_on_insert
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION calculate_ticket_sla_dates_with_priority_client();

-- Enhanced function to recalculate SLA on priority change
CREATE OR REPLACE FUNCTION recalculate_ticket_sla_on_priority_change_with_client()
RETURNS TRIGGER AS $$
DECLARE
    first_response_hours INT;
    resolution_hours INT;
    is_priority BOOLEAN;
BEGIN
    -- Only recalculate if priority has changed
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        -- Check if this is a priority client
        SELECT COALESCE(is_priority_client, FALSE) INTO is_priority
        FROM organizations
        WHERE id = NEW.organization_id;
        
        -- Get new response times based on updated priority
        CASE NEW.priority
            WHEN 'critical' THEN
                first_response_hours := 1;
                resolution_hours := 4;
            WHEN 'high' THEN
                first_response_hours := 4;
                resolution_hours := 24;
            WHEN 'medium' THEN
                first_response_hours := 8;
                resolution_hours := 48;
            WHEN 'low' THEN
                first_response_hours := 24;
                resolution_hours := 72;
            ELSE
                first_response_hours := 8;
                resolution_hours := 48;
        END CASE;
        
        -- Reduce response times by 50% for priority clients
        IF is_priority THEN
            first_response_hours := GREATEST(1, first_response_hours / 2);
            resolution_hours := GREATEST(2, resolution_hours / 2);
        END IF;

        -- Only update first response due if not already responded
        IF NEW.first_response_at IS NULL THEN
            NEW.first_response_due_at := NEW.created_at + (first_response_hours || ' hours')::INTERVAL;
        END IF;

        -- Only update SLA due if not already resolved
        IF NEW.resolved_at IS NULL THEN
            NEW.sla_due_at := NEW.created_at + (resolution_hours || ' hours')::INTERVAL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for priority updates
CREATE TRIGGER recalculate_ticket_sla_on_priority_update
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_ticket_sla_on_priority_change_with_client();

-- =============================================================================
-- FUNCTION: Get Tickets Needing SLA Notifications
-- =============================================================================

CREATE OR REPLACE FUNCTION get_tickets_needing_sla_notifications()
RETURNS TABLE (
    ticket_id UUID,
    organization_id UUID,
    ticket_number INT,
    subject VARCHAR,
    priority VARCHAR,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    first_response_due_at TIMESTAMP WITH TIME ZONE,
    sla_due_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    hours_until_first_response NUMERIC,
    hours_until_resolution NUMERIC,
    is_priority_client BOOLEAN,
    notification_level VARCHAR -- 'warning' or 'breach'
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id AS ticket_id,
        t.organization_id,
        t.ticket_number,
        t.subject,
        t.priority,
        t.status,
        t.created_at,
        t.first_response_due_at,
        t.sla_due_at,
        t.first_response_at,
        EXTRACT(EPOCH FROM (t.first_response_due_at - NOW())) / 3600 AS hours_until_first_response,
        EXTRACT(EPOCH FROM (t.sla_due_at - NOW())) / 3600 AS hours_until_resolution,
        COALESCE(o.is_priority_client, FALSE) AS is_priority_client,
        CASE 
            -- Breach: overdue
            WHEN t.first_response_at IS NULL AND t.first_response_due_at < NOW() THEN 'breach'
            WHEN t.resolved_at IS NULL AND t.sla_due_at < NOW() THEN 'breach'
            -- Warning: within 25% of deadline
            WHEN t.first_response_at IS NULL 
                AND t.first_response_due_at IS NOT NULL
                AND EXTRACT(EPOCH FROM (t.first_response_due_at - NOW())) < EXTRACT(EPOCH FROM (t.first_response_due_at - t.created_at)) * 0.25 
                THEN 'warning'
            WHEN t.resolved_at IS NULL 
                AND t.sla_due_at IS NOT NULL
                AND EXTRACT(EPOCH FROM (t.sla_due_at - NOW())) < EXTRACT(EPOCH FROM (t.sla_due_at - t.created_at)) * 0.25 
                THEN 'warning'
            ELSE NULL
        END AS notification_level
    FROM tickets t
    INNER JOIN organizations o ON t.organization_id = o.id
    WHERE 
        t.status NOT IN ('resolved', 'closed', 'cancelled')
        AND (
            -- Need first response and overdue or close to deadline
            (t.first_response_at IS NULL AND t.first_response_due_at IS NOT NULL)
            OR
            -- Need resolution and overdue or close to deadline
            (t.resolved_at IS NULL AND t.sla_due_at IS NOT NULL)
        )
    ORDER BY 
        notification_level DESC, -- breach first
        hours_until_first_response ASC NULLS LAST,
        hours_until_resolution ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_tickets_needing_sla_notifications IS 'Returns tickets that need SLA warning or breach notifications';

-- =============================================================================
-- UPDATE EXISTING TICKETS WITH PRIORITY CLIENT SLA
-- =============================================================================

-- Update existing tickets from priority clients with adjusted SLA times
UPDATE tickets t
SET
    first_response_due_at = CASE t.priority
        WHEN 'critical' THEN t.created_at + INTERVAL '30 minutes'  -- 1h -> 0.5h
        WHEN 'high' THEN t.created_at + INTERVAL '2 hours'          -- 4h -> 2h
        WHEN 'medium' THEN t.created_at + INTERVAL '4 hours'        -- 8h -> 4h
        WHEN 'low' THEN t.created_at + INTERVAL '12 hours'          -- 24h -> 12h
        ELSE t.created_at + INTERVAL '4 hours'
    END,
    sla_due_at = CASE t.priority
        WHEN 'critical' THEN t.created_at + INTERVAL '2 hours'      -- 4h -> 2h
        WHEN 'high' THEN t.created_at + INTERVAL '12 hours'         -- 24h -> 12h
        WHEN 'medium' THEN t.created_at + INTERVAL '24 hours'       -- 48h -> 24h
        WHEN 'low' THEN t.created_at + INTERVAL '36 hours'          -- 72h -> 36h
        ELSE t.created_at + INTERVAL '24 hours'
    END
FROM organizations o
WHERE 
    t.organization_id = o.id
    AND o.is_priority_client = TRUE
    AND t.status NOT IN ('resolved', 'closed', 'cancelled');
