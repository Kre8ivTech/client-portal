-- Migration: Ticket Priority SLA Fields
-- Description: Add fields for tracking first response SLA and auto-calculating SLA due dates
-- Date: 2026-02-02

-- =============================================================================
-- ADD FIRST RESPONSE DUE FIELD
-- =============================================================================

-- Add first_response_due_at to track when first response is due (based on priority)
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMP WITH TIME ZONE;

-- Add comment describing the SLA response time configuration
COMMENT ON COLUMN tickets.priority IS 'Ticket priority with response time SLAs: critical (1h/4h), high (4h/24h), medium (8h/48h), low (24h/72h)';
COMMENT ON COLUMN tickets.first_response_due_at IS 'When first response is due based on priority SLA';
COMMENT ON COLUMN tickets.first_response_at IS 'When first response was actually made';
COMMENT ON COLUMN tickets.sla_due_at IS 'When ticket resolution is due based on priority SLA';

-- =============================================================================
-- FUNCTION: Calculate SLA Due Dates Based on Priority
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_ticket_sla_dates()
RETURNS TRIGGER AS $$
DECLARE
    first_response_hours INT;
    resolution_hours INT;
BEGIN
    -- Only calculate if sla_due_at or first_response_due_at are not already set
    IF NEW.sla_due_at IS NULL OR NEW.first_response_due_at IS NULL THEN
        -- Get response times based on priority
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

-- =============================================================================
-- TRIGGER: Auto-calculate SLA dates on insert
-- =============================================================================

DROP TRIGGER IF EXISTS calculate_ticket_sla_on_insert ON tickets;

CREATE TRIGGER calculate_ticket_sla_on_insert
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION calculate_ticket_sla_dates();

-- =============================================================================
-- FUNCTION: Recalculate SLA on Priority Change
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_ticket_sla_on_priority_change()
RETURNS TRIGGER AS $$
DECLARE
    first_response_hours INT;
    resolution_hours INT;
BEGIN
    -- Only recalculate if priority has changed
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
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

-- =============================================================================
-- TRIGGER: Recalculate SLA on priority update
-- =============================================================================

DROP TRIGGER IF EXISTS recalculate_ticket_sla_on_priority_update ON tickets;

CREATE TRIGGER recalculate_ticket_sla_on_priority_update
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_ticket_sla_on_priority_change();

-- =============================================================================
-- UPDATE EXISTING TICKETS: Set SLA dates for tickets missing them
-- =============================================================================

-- Update existing tickets that don't have SLA dates set
UPDATE tickets
SET
    first_response_due_at = CASE priority
        WHEN 'critical' THEN created_at + INTERVAL '1 hour'
        WHEN 'high' THEN created_at + INTERVAL '4 hours'
        WHEN 'medium' THEN created_at + INTERVAL '8 hours'
        WHEN 'low' THEN created_at + INTERVAL '24 hours'
        ELSE created_at + INTERVAL '8 hours'
    END,
    sla_due_at = CASE priority
        WHEN 'critical' THEN created_at + INTERVAL '4 hours'
        WHEN 'high' THEN created_at + INTERVAL '24 hours'
        WHEN 'medium' THEN created_at + INTERVAL '48 hours'
        WHEN 'low' THEN created_at + INTERVAL '72 hours'
        ELSE created_at + INTERVAL '48 hours'
    END
WHERE first_response_due_at IS NULL OR sla_due_at IS NULL;

-- =============================================================================
-- INDEX: For SLA tracking queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tickets_first_response_due ON tickets(first_response_due_at)
    WHERE first_response_at IS NULL AND status NOT IN ('resolved', 'closed');

CREATE INDEX IF NOT EXISTS idx_tickets_sla_due ON tickets(sla_due_at)
    WHERE resolved_at IS NULL AND status NOT IN ('resolved', 'closed');
