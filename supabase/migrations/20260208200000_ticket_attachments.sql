-- Migration: Ticket Attachments
-- Description: Junction table linking tickets to organization_files for file attachments
-- Date: 2026-02-08

-- =============================================================================
-- TICKET ATTACHMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES organization_files(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate attachments
    UNIQUE(ticket_id, file_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_file ON ticket_attachments(file_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Users can view attachments for tickets they can access (RLS on tickets handles org isolation)
CREATE POLICY "Users can view ticket attachments"
ON ticket_attachments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_attachments.ticket_id
    )
);

-- Users can add attachments to tickets they can access
CREATE POLICY "Users can add ticket attachments"
ON ticket_attachments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_attachments.ticket_id
    )
);

-- Users can remove attachments from tickets they created
CREATE POLICY "Users can remove own ticket attachments"
ON ticket_attachments FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_attachments.ticket_id
        AND t.created_by = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('staff', 'super_admin')
    )
);

-- Grant access
GRANT ALL ON ticket_attachments TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
