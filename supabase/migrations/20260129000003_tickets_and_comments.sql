-- Migration: Tickets and Comments
-- Description: Core tables for ticketing system with multi-tenant RLS
-- Date: 2026-01-29

-- =============================================================================
-- TICKETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Identifiers
    ticket_number SERIAL, -- Global sequence for simplified numbering
    
    -- Content
    subject VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    
    -- Classification
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' 
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(30) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'open', 'in_progress', 'pending_client', 'resolved', 'closed')),
    category VARCHAR(100),
    tags JSONB DEFAULT '[]',
    
    -- Assignment
    created_by UUID NOT NULL REFERENCES profiles(id),
    assigned_to UUID REFERENCES profiles(id),
    
    -- Relationships
    parent_ticket_id UUID REFERENCES tickets(id),
    
    -- SLA & Timing
    sla_due_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_tickets_organization ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);

-- Trigger for updated_at
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TICKET COMMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    
    attachments JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author ON ticket_comments(author_id);

-- Trigger for updated_at
CREATE TRIGGER update_ticket_comments_updated_at
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) policies
-- =============================================================================

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- TICKETS POLICIES
-- -----------------------------------------------------------------------------

-- 1. Staff and Super Admins can do everything
CREATE POLICY "Staff can manage all tickets"
ON tickets FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('staff', 'super_admin')
    )
);

-- 2. Partners can manage their own tickets and their clients' tickets
CREATE POLICY "Partners can manage their and client tickets"
ON tickets FOR ALL
TO authenticated
USING (
    organization_id IN (
        SELECT id FROM organizations
        WHERE id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) -- Own org
        OR parent_org_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) -- Client orgs
    )
)
WITH CHECK (
    organization_id IN (
        SELECT id FROM organizations
        WHERE id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
        OR parent_org_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
);

-- 3. Clients can see and create tickets for their own organization
CREATE POLICY "Clients can manage own tickets"
ON tickets FOR ALL
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
)
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
);

-- -----------------------------------------------------------------------------
-- TICKET COMMENTS POLICIES
-- -----------------------------------------------------------------------------

-- 1. Visibility Policy
-- Everyone can see non-internal comments for tickets they have access to.
-- Only staff/partners can see internal comments if they have access to the ticket.

CREATE POLICY "Users can view relevant comments"
ON ticket_comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_comments.ticket_id
        -- Re-use ticket visibility logic or simplify if policies are inherited? 
        -- (Postgres RLS doesn't inherit by default, so we check ticket access)
    )
    AND (
        -- Not internal
        is_internal = FALSE
        OR
        -- OR User is staff or partner of the org/parent org
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('staff', 'super_admin', 'partner', 'partner_staff')
        )
    )
);

-- 2. Insert Policy
-- Users can comment on tickets they can see.
CREATE POLICY "Users can create comments on accessible tickets"
ON ticket_comments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tickets t WHERE t.id = ticket_id
    )
);

-- 3. Update Policy (Author only)
CREATE POLICY "Authors can update own comments"
ON ticket_comments FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());
