-- Migration: Add client-requested due date to tickets
-- Description: Optional due date that clients can set when creating tickets
-- Date: 2026-02-08

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS client_due_date DATE;

COMMENT ON COLUMN tickets.client_due_date IS 'Optional due date requested by the client when creating the ticket';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
