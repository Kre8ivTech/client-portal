-- Migration: Tickets RLS Policies
-- Description: Row-level security for tickets and comments
-- Date: 2026-01-29

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TICKETS POLICIES
-- =============================================================================

-- Super admins and staff can view all tickets
CREATE POLICY "Staff can view all tickets"
    ON tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Clients can view their own tickets
CREATE POLICY "Clients can view own tickets"
    ON tickets FOR SELECT
    USING (
        created_by = auth.uid()
        OR assigned_to = auth.uid()
    );

-- Partners can view tickets from their organization and their clients
CREATE POLICY "Partners can view org and client tickets"
    ON tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('partner', 'partner_staff')
            AND (
                -- Tickets in partner's own org
                tickets.organization_id = p.organization_id
                OR
                -- Tickets from client orgs under this partner
                tickets.organization_id IN (
                    SELECT o.id FROM organizations o
                    WHERE o.parent_org_id = p.organization_id
                )
            )
        )
    );

-- Users can create tickets in their organization
CREATE POLICY "Users can create tickets in own org"
    ON tickets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.organization_id = tickets.organization_id
        )
    );

-- Staff can update any ticket
CREATE POLICY "Staff can update any ticket"
    ON tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Users can update their own tickets (limited fields handled in app)
CREATE POLICY "Users can update own tickets"
    ON tickets FOR UPDATE
    USING (created_by = auth.uid());

-- Partners can update tickets in their scope
CREATE POLICY "Partners can update scoped tickets"
    ON tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('partner', 'partner_staff')
            AND (
                tickets.organization_id = p.organization_id
                OR tickets.organization_id IN (
                    SELECT o.id FROM organizations o
                    WHERE o.parent_org_id = p.organization_id
                )
            )
        )
    );

-- Only super_admin can delete tickets
CREATE POLICY "Only super_admin can delete tickets"
    ON tickets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- =============================================================================
-- TICKET COMMENTS POLICIES
-- =============================================================================

-- Staff can view all comments
CREATE POLICY "Staff can view all comments"
    ON ticket_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Non-staff can view non-internal comments on tickets they can access
CREATE POLICY "Users can view public comments on accessible tickets"
    ON ticket_comments FOR SELECT
    USING (
        is_internal = FALSE
        AND EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_comments.ticket_id
            AND (
                t.created_by = auth.uid()
                OR t.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid()
                    AND p.role IN ('partner', 'partner_staff')
                    AND (
                        t.organization_id = p.organization_id
                        OR t.organization_id IN (
                            SELECT o.id FROM organizations o
                            WHERE o.parent_org_id = p.organization_id
                        )
                    )
                )
            )
        )
    );

-- Users can add comments to tickets they can access
CREATE POLICY "Users can add comments to accessible tickets"
    ON ticket_comments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_comments.ticket_id
            AND (
                t.created_by = auth.uid()
                OR t.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid()
                    AND (
                        p.role IN ('super_admin', 'staff')
                        OR (
                            p.role IN ('partner', 'partner_staff')
                            AND (
                                t.organization_id = p.organization_id
                                OR t.organization_id IN (
                                    SELECT o.id FROM organizations o
                                    WHERE o.parent_org_id = p.organization_id
                                )
                            )
                        )
                    )
                )
            )
        )
    );

-- Only staff can create internal comments
CREATE POLICY "Only staff can create internal comments"
    ON ticket_comments FOR INSERT
    WITH CHECK (
        is_internal = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
    ON ticket_comments FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
    ON ticket_comments FOR DELETE
    USING (user_id = auth.uid());

-- =============================================================================
-- TICKET CATEGORIES POLICIES
-- =============================================================================

-- Everyone can read active categories
CREATE POLICY "Anyone can view active categories"
    ON ticket_categories FOR SELECT
    USING (
        is_active = TRUE
        AND (
            organization_id IS NULL
            OR EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND (
                    profiles.organization_id = ticket_categories.organization_id
                    OR profiles.role IN ('super_admin', 'staff')
                )
            )
        )
    );

-- Only staff can manage categories
CREATE POLICY "Staff can manage categories"
    ON ticket_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );
