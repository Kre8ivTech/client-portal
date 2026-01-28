-- Migration: Queue Calculation Logic
-- Description: Function and trigger to calculate queue positions for tickets
-- Date: 2026-01-28

-- =============================================================================
-- FUNCTION: calculate_queue_positions
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_queue_positions()
RETURNS TRIGGER AS $$
BEGIN
  -- We only need to recalculate if:
  -- 1. A new ticket is created (INSERT) with 'new' or 'open' status
  -- 2. A ticket status changes (UPDATE) to/from 'new'/'open'
  -- 3. A ticket priority changes (UPDATE)
  
  -- Optimization: Only recalculate for the affected organization and priority
  -- However, since queue is global per organization, we can just filter by organization.
  
  -- If we wanted a global queue (across all clients of a partner), we'd need more complex logic.
  -- For now, assuming queue is per-organization (tenant).
  
  -- We'll just recalculate for all open tickets in the organization
  -- This might be expensive if an org has 10k open tickets, but for MVP it's fine.
  
  WITH ranked_tickets AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY organization_id, priority 
        ORDER BY created_at ASC
      ) as new_position
    FROM tickets
    WHERE 
      organization_id = NEW.organization_id
      AND status IN ('new', 'open', 'in_progress') -- Active tickets in queue
  )
  UPDATE tickets
  SET 
    queue_position = ranked_tickets.new_position,
    queue_calculated_at = NOW()
  FROM ranked_tickets
  WHERE tickets.id = ranked_tickets.id
  AND (tickets.queue_position IS DISTINCT FROM ranked_tickets.new_position);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGER
-- =============================================================================

CREATE TRIGGER trigger_calculate_queue
  AFTER INSERT OR UPDATE OF status, priority, organization_id
  ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION calculate_queue_positions();
