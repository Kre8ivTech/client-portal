-- Migration: Initial Schema
-- Description: Foundational tables for organizations, profiles, and payment terms
-- Date: 2026-01-20

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ORGANIZATIONS (Tenants)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('kre8ivtech', 'partner', 'client')),
    parent_org_id UUID REFERENCES organizations(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    
    -- Branding
    branding_config JSONB DEFAULT '{}',
    
    -- Domain
    custom_domain VARCHAR(255),
    custom_domain_verified BOOLEAN DEFAULT FALSE,
    custom_domain_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_organizations_custom_domain ON organizations(custom_domain) WHERE custom_domain IS NOT NULL;

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PROFILES (Linked to auth.users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    
    -- Identity
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    
    -- Role & Permissions
    -- Roles align with PRD: super_admin, staff, partner, partner_staff, client
    role VARCHAR(50) NOT NULL DEFAULT 'client' CHECK (role IN ('super_admin', 'staff', 'partner', 'partner_staff', 'client')),
    permissions JSONB DEFAULT '[]',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
    
    -- Presence
    presence_status VARCHAR(20) DEFAULT 'offline' CHECK (presence_status IN ('online', 'offline', 'away', 'dnd')),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    
    -- Preferences
    notification_preferences JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PAYMENT TERMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id), -- NULL = system default
    
    name VARCHAR(100) NOT NULL,
    days INTEGER NOT NULL DEFAULT 30,
    description TEXT,
    
    -- Late fees
    late_fee_type VARCHAR(20) CHECK (late_fee_type IN ('percentage', 'fixed')),
    late_fee_amount INTEGER, -- Stored in cents or percentage*100
    grace_period_days INTEGER DEFAULT 0,
    
    -- Early payment
    early_discount_percent NUMERIC(5,2),
    early_discount_days INTEGER,
    
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_terms_organization ON payment_terms(organization_id);

CREATE TRIGGER update_payment_terms_updated_at
    BEFORE UPDATE ON payment_terms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INITIAL SEED DATA
-- =============================================================================

-- Create the root Kre8ivTech organization
INSERT INTO organizations (name, slug, type, status)
VALUES ('Kre8ivTech, LLC', 'kre8ivtech', 'kre8ivtech', 'active')
ON CONFLICT (slug) DO NOTHING;
