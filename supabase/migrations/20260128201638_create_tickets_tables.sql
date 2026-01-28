-- Migration: Create Tickets Tables
-- Description: Tables for tickets, comments, and attachments
-- Date: 2026-01-28

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE ticket_status AS ENUM (
  'new',
  'open',
  'in_progress',
  'pending_client',
  'resolved',
  'closed'
);

CREATE TYPE ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE ticket_category AS ENUM (
  'technical_support',
  'billing',
  'general_inquiry',
  'bug_report',
  'feature_request'
);

-- =============================================================================
-- TICKETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Content
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status ticket_status NOT NULL DEFAULT 'new',
    priority ticket_priority NOT NULL DEFAULT 'medium',
    category ticket_category NOT NULL DEFAULT 'general_inquiry',
    
    -- Identifiers
    ticket_number SERIAL, -- Unique per system, but we might want per-tenant later
    
    -- Assignments
    assigned_to UUID REFERENCES profiles(id),
    created_by UUID NOT NULL REFERENCES profiles(id),
    
    -- Queue Logic
    queue_position INTEGER,
    queue_calculated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_organization ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- Update trigger
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TICKET COMMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal notes for staff
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at);

-- Update trigger
CREATE TRIGGER update_ticket_comments_updated_at
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TICKET ATTACHMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
    
    -- File Info
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    storage_path VARCHAR(500) NOT NULL,
    
    -- Metadata
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);

-- Enable RLS
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- TICKETS POLICIES

-- 1. View: Users can view tickets in their organization
CREATE POLICY "Users can view org tickets"
  ON tickets FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
    OR is_super_admin()
  );

-- 2. Create: Users can create tickets for their organization
CREATE POLICY "Users can create org tickets"
  ON tickets FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- 3. Update: Users can update tickets in their organization (e.g. close, add details)
-- Note: Further restrictions might be needed for specific fields (e.g. clients shouldn't change priority)
CREATE POLICY "Users can update org tickets"
  ON tickets FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
    OR is_super_admin()
  );

-- COMMENTS POLICIES

-- 1. View: Users can view comments on tickets they can see
-- EXCLUDING internal notes if they are clients
CREATE POLICY "Users can view public comments"
  ON ticket_comments FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM tickets
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND (
      NOT is_internal 
      OR 
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('staff', 'super_admin', 'partner', 'partner_staff')
      )
    )
  );

-- 2. Create: Users can add comments to tickets they have access to
CREATE POLICY "Users can add comments"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM tickets
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
