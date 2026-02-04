-- Migration: Add time tracking sync to tickets
-- Description: Adds total_time_logged column to tickets and trigger to keep it in sync

-- Add total time columns to tickets
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS total_time_logged NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS billable_time_logged NUMERIC(10, 2) DEFAULT 0;

-- Create index for time tracking queries
CREATE INDEX IF NOT EXISTS idx_tickets_time_logged ON tickets(total_time_logged) WHERE total_time_logged > 0;

-- Function to sync ticket time totals from time_entries
CREATE OR REPLACE FUNCTION sync_ticket_time_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket_id UUID;
  v_total_hours NUMERIC(10, 2);
  v_billable_hours NUMERIC(10, 2);
BEGIN
  -- Determine which ticket to update
  IF TG_OP = 'DELETE' THEN
    v_ticket_id := OLD.ticket_id;
  ELSE
    v_ticket_id := NEW.ticket_id;
  END IF;

  -- Skip if no ticket associated
  IF v_ticket_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Calculate totals
  SELECT 
    COALESCE(SUM(hours), 0),
    COALESCE(SUM(CASE WHEN billable THEN hours ELSE 0 END), 0)
  INTO v_total_hours, v_billable_hours
  FROM time_entries
  WHERE ticket_id = v_ticket_id;

  -- Update ticket
  UPDATE tickets
  SET 
    total_time_logged = v_total_hours,
    billable_time_logged = v_billable_hours,
    updated_at = NOW()
  WHERE id = v_ticket_id;

  -- Handle UPDATE where ticket_id changes
  IF TG_OP = 'UPDATE' AND OLD.ticket_id IS DISTINCT FROM NEW.ticket_id AND OLD.ticket_id IS NOT NULL THEN
    -- Recalculate old ticket
    SELECT 
      COALESCE(SUM(hours), 0),
      COALESCE(SUM(CASE WHEN billable THEN hours ELSE 0 END), 0)
    INTO v_total_hours, v_billable_hours
    FROM time_entries
    WHERE ticket_id = OLD.ticket_id;

    UPDATE tickets
    SET 
      total_time_logged = v_total_hours,
      billable_time_logged = v_billable_hours,
      updated_at = NOW()
    WHERE id = OLD.ticket_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on time_entries
DROP TRIGGER IF EXISTS sync_ticket_time_on_entry ON time_entries;
CREATE TRIGGER sync_ticket_time_on_entry
  AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_ticket_time_totals();

-- Backfill existing time totals
UPDATE tickets t
SET 
  total_time_logged = COALESCE(te.total_hours, 0),
  billable_time_logged = COALESCE(te.billable_hours, 0)
FROM (
  SELECT 
    ticket_id,
    SUM(hours) AS total_hours,
    SUM(CASE WHEN billable THEN hours ELSE 0 END) AS billable_hours
  FROM time_entries
  WHERE ticket_id IS NOT NULL
  GROUP BY ticket_id
) te
WHERE t.id = te.ticket_id;

-- Comments
COMMENT ON COLUMN tickets.total_time_logged IS 'Total hours logged against this ticket (auto-calculated)';
COMMENT ON COLUMN tickets.billable_time_logged IS 'Total billable hours logged against this ticket (auto-calculated)';
COMMENT ON FUNCTION sync_ticket_time_totals IS 'Trigger function to keep ticket time totals in sync with time_entries';
