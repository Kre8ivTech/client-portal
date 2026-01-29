-- Migration: Create Tickets System
-- Description: Tickets and ticket comments for support system
-- Date: 2026-01-29

-- =============================================================================
-- TICKETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identifiers
    ticket_number VARCHAR(50) NOT NULL,
    
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
    -- For partners: which client org this ticket is for
    client_org_id UUID REFERENCES organizations(id),
    
    -- SLA
    sla_due_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Queue
    queue_position INTEGER,
    queue_calculated_at TIMESTAMP WITH TIME ZONE,
    
    -- Custom fields for extensibility
    custom_fields JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, ticket_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_client_org ON tickets(client_org_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TICKET COMMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    
    -- Content
    content TEXT NOT NULL,
    
    -- Internal notes visible only to staff
    is_internal BOOLEAN DEFAULT FALSE,
    
    -- Attachments stored as JSON array
    -- [{ "id": "...", "filename": "...", "url": "...", "size": 1234, "type": "image/png" }]
    attachments JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user ON ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created ON ticket_comments(created_at);

CREATE TRIGGER update_ticket_comments_updated_at
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TICKET NUMBER SEQUENCE
-- =============================================================================

-- Function to generate ticket numbers with org prefix
-- Format: ORG_SLUG-NNNN (e.g., KT-0001, PARTNER-0042)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    org_slug VARCHAR(20);
    next_num INTEGER;
BEGIN
    -- Get organization slug (truncated for readability)
    SELECT UPPER(LEFT(slug, 10)) INTO org_slug
    FROM organizations
    WHERE id = NEW.organization_id;
    
    -- Get next ticket number for this org
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(ticket_number, '-', 2) AS INTEGER)
    ), 0) + 1 INTO next_num
    FROM tickets
    WHERE organization_id = NEW.organization_id;
    
    -- Set the ticket number
    NEW.ticket_number := org_slug || '-' || LPAD(next_num::TEXT, 4, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW
    WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
    EXECUTE FUNCTION generate_ticket_number();

-- =============================================================================
-- TICKET CATEGORIES (Predefined)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id), -- NULL = system default
    
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50), -- Lucide icon name
    color VARCHAR(20), -- Tailwind color class
    
    -- SLA defaults for this category
    default_priority VARCHAR(20) DEFAULT 'medium',
    sla_response_hours INTEGER, -- Target first response time
    sla_resolution_hours INTEGER, -- Target resolution time
    
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_ticket_categories_org ON ticket_categories(organization_id);

-- Insert default categories
INSERT INTO ticket_categories (organization_id, name, slug, description, icon, default_priority, sla_response_hours, sla_resolution_hours, sort_order)
VALUES 
    (NULL, 'Technical Support', 'technical-support', 'Technical issues and troubleshooting', 'Wrench', 'medium', 4, 24, 1),
    (NULL, 'Billing', 'billing', 'Invoice and payment inquiries', 'CreditCard', 'medium', 8, 48, 2),
    (NULL, 'General Inquiry', 'general-inquiry', 'General questions and information', 'HelpCircle', 'low', 24, 72, 3),
    (NULL, 'Bug Report', 'bug-report', 'Report software bugs or issues', 'Bug', 'high', 2, 24, 4),
    (NULL, 'Feature Request', 'feature-request', 'Suggest new features or improvements', 'Lightbulb', 'low', 48, NULL, 5)
ON CONFLICT DO NOTHING;
