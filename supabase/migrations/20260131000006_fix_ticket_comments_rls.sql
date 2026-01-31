-- Migration: Fix ticket_comments RLS to enforce ticket access (org/partner)
-- Description: SELECT and INSERT must restrict by same logic as tickets table
-- Date: 2026-01-31

-- Drop existing ticket_comments policies
DROP POLICY IF EXISTS "Users can view relevant comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can create comments on accessible tickets" ON ticket_comments;
DROP POLICY IF EXISTS "Authors can update own comments" ON ticket_comments;

-- -----------------------------------------------------------------------------
-- TICKET COMMENTS POLICIES (recreate with proper ticket access)
-- -----------------------------------------------------------------------------

-- 1. SELECT: User can see comment only if they have access to the ticket
--    (same logic as tickets: staff/super_admin all; partners own+client orgs; clients own org)
--    AND (comment is not internal OR user is staff/partner)
CREATE POLICY "Users can view relevant comments"
ON ticket_comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_comments.ticket_id
        AND (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('staff', 'super_admin'))
            OR t.organization_id IN (
                SELECT id FROM organizations
                WHERE id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
                OR parent_org_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
            )
            OR t.organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    )
    AND (
        is_internal = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('staff', 'super_admin', 'partner', 'partner_staff')
        )
    )
);

-- 2. INSERT: User can comment only on tickets they have access to (same as SELECT on tickets)
CREATE POLICY "Users can create comments on accessible tickets"
ON ticket_comments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_comments.ticket_id
        AND (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('staff', 'super_admin'))
            OR t.organization_id IN (
                SELECT id FROM organizations
                WHERE id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
                OR parent_org_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
            )
            OR t.organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    )
);

-- 3. UPDATE: Author only (unchanged)
CREATE POLICY "Authors can update own comments"
ON ticket_comments FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());
