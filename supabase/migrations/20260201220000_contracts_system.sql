-- Migration: Contracts System
-- Description: Complete contracting system with templates, signers, and audit logs
-- Date: 2026-02-01

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE contract_type AS ENUM (
    'service_agreement',
    'nda',
    'sow',
    'amendment',
    'custom'
);

CREATE TYPE contract_status AS ENUM (
    'draft',
    'pending_signature',
    'signed',
    'expired',
    'cancelled'
);

CREATE TYPE signer_role AS ENUM (
    'client',
    'company_representative',
    'witness',
    'approver'
);

CREATE TYPE signer_status AS ENUM (
    'pending',
    'sent',
    'viewed',
    'signed',
    'declined'
);

-- =============================================================================
-- CONTRACT TEMPLATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id), -- NULL = global template
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    contract_type contract_type NOT NULL,
    
    -- Template content with variable placeholders (e.g., {{client_name}}, {{service_description}})
    template_content TEXT NOT NULL,
    
    -- Define variables and their types/defaults
    variables JSONB DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_templates_organization ON contract_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON contract_templates(contract_type);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON contract_templates(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_contract_templates_updated_at
    BEFORE UPDATE ON contract_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CONTRACTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    client_id UUID NOT NULL REFERENCES users(id), -- The client signing this contract
    template_id UUID REFERENCES contract_templates(id),
    
    -- Contract details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    contract_type contract_type NOT NULL,
    status contract_status NOT NULL DEFAULT 'draft',
    
    -- DocuSign integration
    docusign_envelope_id VARCHAR(255),
    docusign_status VARCHAR(50),
    
    -- Document storage
    document_url TEXT, -- URL to signed PDF in Supabase Storage
    
    -- Important dates
    signed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional data (terms, conditions, custom fields)
    metadata JSONB DEFAULT '{}',
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_organization ON contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_docusign_envelope ON contracts(docusign_envelope_id) WHERE docusign_envelope_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CONTRACT SIGNERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS contract_signers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    -- Signer identity
    user_id UUID REFERENCES users(id), -- NULL if external signer
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    
    -- Signing details
    role signer_role NOT NULL,
    signing_order INTEGER NOT NULL DEFAULT 1,
    status signer_status NOT NULL DEFAULT 'pending',
    
    signed_at TIMESTAMP WITH TIME ZONE,
    
    -- DocuSign integration
    docusign_recipient_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_signers_contract ON contract_signers(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signers_user ON contract_signers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contract_signers_status ON contract_signers(status);
CREATE INDEX IF NOT EXISTS idx_contract_signers_order ON contract_signers(contract_id, signing_order);

-- =============================================================================
-- CONTRACT AUDIT LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS contract_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    -- Action tracking
    action VARCHAR(100) NOT NULL, -- e.g., 'created', 'sent_for_signature', 'signed', 'viewed', 'downloaded', 'cancelled'
    performed_by UUID REFERENCES users(id), -- NULL if system action
    
    -- Additional context
    details JSONB DEFAULT '{}',
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_contract ON contract_audit_log(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_created_at ON contract_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_action ON contract_audit_log(action);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_audit_log ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- CONTRACT TEMPLATES POLICIES
-- -----------------------------------------------------------------------------

-- View: Users can view templates in their organization or global templates
CREATE POLICY "Users can view org and global templates"
ON contract_templates FOR SELECT
TO authenticated
USING (
    organization_id IS NULL -- Global templates
    OR
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

-- Insert/Update: Only super_admin and staff can manage templates
CREATE POLICY "Staff can manage templates"
ON contract_templates FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- -----------------------------------------------------------------------------
-- CONTRACTS POLICIES
-- -----------------------------------------------------------------------------

-- View: Users can view contracts in their organization or if they're the client
CREATE POLICY "Users can view relevant contracts"
ON contracts FOR SELECT
TO authenticated
USING (
    -- Staff and super admins can view all contracts
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
    OR
    -- Partners can view contracts in their org or client orgs
    organization_id IN (
        SELECT id FROM organizations
        WHERE id IN (SELECT organization_id FROM users WHERE id = auth.uid())
        OR parent_org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    OR
    -- Users can view contracts where they are the client
    client_id = auth.uid()
    OR
    -- Users can view contracts where they are a signer
    EXISTS (
        SELECT 1 FROM contract_signers
        WHERE contract_id = contracts.id
        AND user_id = auth.uid()
    )
);

-- Insert/Update/Delete: Only super_admin and staff
CREATE POLICY "Staff can manage contracts"
ON contracts FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

CREATE POLICY "Staff can update contracts"
ON contracts FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

CREATE POLICY "Staff can delete contracts"
ON contracts FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- -----------------------------------------------------------------------------
-- CONTRACT SIGNERS POLICIES
-- -----------------------------------------------------------------------------

-- View: Users can view signers for contracts they can view
CREATE POLICY "Users can view contract signers"
ON contract_signers FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM contracts
        WHERE id = contract_signers.contract_id
        -- Contract visibility is enforced by contracts table RLS
    )
);

-- Insert/Update: Only staff can manage signers
CREATE POLICY "Staff can manage signers"
ON contract_signers FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- -----------------------------------------------------------------------------
-- CONTRACT AUDIT LOG POLICIES
-- -----------------------------------------------------------------------------

-- View: Users can view audit logs for contracts they can view
CREATE POLICY "Users can view audit logs"
ON contract_audit_log FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM contracts
        WHERE id = contract_audit_log.contract_id
    )
);

-- Insert: All authenticated users can create audit log entries (for tracking actions)
CREATE POLICY "Authenticated users can create audit logs"
ON contract_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);
