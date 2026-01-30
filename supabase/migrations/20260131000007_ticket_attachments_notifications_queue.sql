-- Migration: Ticket attachments, notifications, and queue position
-- Description: Adds attachments storage, notifications table, queue function
-- Date: 2026-01-31

-- =============================================================================
-- TICKET ATTACHMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_org ON ticket_attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploader ON ticket_attachments(uploaded_by);

ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ticket attachments"
ON ticket_attachments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM tickets t
        JOIN profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_attachments.ticket_id
        AND (
            p.role IN ('staff', 'super_admin')
            OR t.organization_id = p.organization_id
            OR t.organization_id IN (
                SELECT id FROM organizations WHERE parent_org_id = p.organization_id
            )
        )
    )
);

CREATE POLICY "Users can upload ticket attachments"
ON ticket_attachments FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM tickets t
        JOIN profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_attachments.ticket_id
        AND (
            p.role IN ('staff', 'super_admin')
            OR t.organization_id = p.organization_id
            OR t.organization_id IN (
                SELECT id FROM organizations WHERE parent_org_id = p.organization_id
            )
        )
    )
);

CREATE POLICY "Users can delete their ticket attachments"
ON ticket_attachments FOR DELETE
TO authenticated
USING (
    uploaded_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);

-- =============================================================================
-- NOTIFICATIONS (IN-APP)
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id),
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can view org notifications"
ON notifications FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);

CREATE POLICY "Users can mark notifications read"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can create notifications for org members"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND user_id IN (
        SELECT id FROM profiles
        WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
);

-- =============================================================================
-- STORAGE BUCKET + POLICIES FOR ATTACHMENTS
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Ticket attachments are readable by org"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'ticket-attachments'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM organizations
        WHERE id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        OR parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
);

CREATE POLICY "Ticket attachments are insertable by org"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM organizations
        WHERE id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        OR parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
);

CREATE POLICY "Ticket attachments are deletable by org"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'ticket-attachments'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM organizations
        WHERE id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        OR parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
);

-- =============================================================================
-- QUEUE POSITION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION get_ticket_queue_position(ticket_id UUID)
RETURNS TABLE(position INTEGER, total INTEGER)
LANGUAGE sql
STABLE
AS $$
    WITH target AS (
        SELECT id, organization_id
        FROM tickets
        WHERE id = ticket_id
    ),
    ranked AS (
        SELECT
            t.id,
            row_number() OVER (
                ORDER BY
                    CASE t.priority
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                        ELSE 5
                    END,
                    t.created_at
            ) AS position,
            count(*) OVER () AS total
        FROM tickets t
        JOIN target tt ON tt.organization_id = t.organization_id
        WHERE t.status IN ('new', 'open', 'in_progress', 'pending_client')
    )
    SELECT position, total FROM ranked WHERE id = ticket_id;
$$;
