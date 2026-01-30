-- Migration: Fix ticket_comments RLS for tenant isolation
-- Description: Enforce ticket access checks for comments
-- Date: 2026-01-31

-- Drop existing policies to replace with stricter access rules
DROP POLICY IF EXISTS "Users can view relevant comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can create comments on accessible tickets" ON ticket_comments;
DROP POLICY IF EXISTS "Authors can update own comments" ON ticket_comments;

-- Users can view comments only if they can access the ticket.
-- Internal comments are limited to staff/partners with ticket access.
CREATE POLICY "Users can view relevant comments"
ON ticket_comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM tickets t
        JOIN profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_comments.ticket_id
        AND (
            p.role IN ('staff', 'super_admin')
            OR t.organization_id = p.organization_id
            OR t.organization_id IN (
                SELECT id FROM organizations WHERE parent_org_id = p.organization_id
            )
        )
    )
    AND (
        ticket_comments.is_internal = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('staff', 'super_admin', 'partner', 'partner_staff')
        )
    )
);

-- Users can create comments only on tickets they can access.
-- Internal comments are limited to staff/partners.
CREATE POLICY "Users can create comments on accessible tickets"
ON ticket_comments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM tickets t
        JOIN profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_comments.ticket_id
        AND (
            p.role IN ('staff', 'super_admin')
            OR t.organization_id = p.organization_id
            OR t.organization_id IN (
                SELECT id FROM organizations WHERE parent_org_id = p.organization_id
            )
        )
    )
    AND (
        ticket_comments.is_internal = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('staff', 'super_admin', 'partner', 'partner_staff')
        )
    )
);

-- Authors can update their own comments if they still have access to the ticket.
CREATE POLICY "Authors can update own comments"
ON ticket_comments FOR UPDATE
TO authenticated
USING (
    author_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM tickets t
        JOIN profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_comments.ticket_id
        AND (
            p.role IN ('staff', 'super_admin')
            OR t.organization_id = p.organization_id
            OR t.organization_id IN (
                SELECT id FROM organizations WHERE parent_org_id = p.organization_id
            )
        )
    )
)
WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM tickets t
        JOIN profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_comments.ticket_id
        AND (
            p.role IN ('staff', 'super_admin')
            OR t.organization_id = p.organization_id
            OR t.organization_id IN (
                SELECT id FROM organizations WHERE parent_org_id = p.organization_id
            )
        )
    )
    AND (
        ticket_comments.is_internal = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('staff', 'super_admin', 'partner', 'partner_staff')
        )
    )
);
