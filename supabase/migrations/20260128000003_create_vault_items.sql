-- Migration: Create Vault Items
-- Description: Secure storage for encrypted credentials
-- Date: 2026-01-28
CREATE TABLE public.vault_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    -- Metadata
    label VARCHAR(255) NOT NULL,
    description TEXT,
    service_url VARCHAR(500),
    username VARCHAR(255),
    -- Encrypted Data (AES-GCM)
    encrypted_password TEXT NOT NULL,
    iv TEXT NOT NULL,
    -- Initialization Vector (base64)
    auth_tag TEXT NOT NULL,
    -- Authentication Tag (base64)
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Indexes
CREATE INDEX idx_vault_org ON public.vault_items(organization_id);
CREATE INDEX idx_vault_created_by ON public.vault_items(created_by);
-- Enable RLS
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;
-- RLS Policies
CREATE POLICY "Users can view vault items for their organization" ON public.vault_items FOR
SELECT USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
        OR is_super_admin()
    );
CREATE POLICY "Users can create vault items for their organization" ON public.vault_items FOR
INSERT WITH CHECK (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can update vault items for their organization" ON public.vault_items FOR
UPDATE USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
        OR is_super_admin()
    );
CREATE POLICY "Users can delete vault items for their organization" ON public.vault_items FOR DELETE USING (
    organization_id = (
        SELECT organization_id
        FROM public.profiles
        WHERE id = auth.uid()
    )
    OR is_super_admin()
);