-- AI Assistant Configuration
-- Stores system prompts and settings for the AI Assistant per role

CREATE TABLE IF NOT EXISTS public.ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- Optional: allow org-specific overrides
    role VARCHAR(50) NOT NULL, -- 'client', 'staff', 'super_admin', 'partner'
    system_prompt TEXT NOT NULL,
    model VARCHAR(50) DEFAULT 'gpt-4o',
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, role) -- One config per role per org (or global if org is null)
);

-- Databases that already had the later ai_configs shape are missing role/model.
ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS model VARCHAR(50) DEFAULT 'gpt-4o';
ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);
UPDATE public.ai_configs SET role = 'global' WHERE role IS NULL;
ALTER TABLE public.ai_configs ALTER COLUMN role SET DEFAULT 'global';
ALTER TABLE public.ai_configs ALTER COLUMN role SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ai_configs_organization_id_role_key
    ON public.ai_configs (organization_id, role);

-- RLS
ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;

-- Admins/Staff can view/edit all configs
DROP POLICY IF EXISTS "Staff can manage ai configs" ON public.ai_configs;
CREATE POLICY "Staff can manage ai configs"
    ON public.ai_configs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('super_admin', 'staff')
        )
    );

-- Everyone can view (read-only) configs for their own role (used by the chat handler)
DROP POLICY IF EXISTS "Users can read own role config" ON public.ai_configs;
CREATE POLICY "Users can read own role config"
    ON public.ai_configs FOR SELECT
    USING (
        role = (SELECT role FROM public.users WHERE id = auth.uid())
        OR 
        role = 'global'
    );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_ai_configs_updated_at ON public.ai_configs;
CREATE TRIGGER update_ai_configs_updated_at
    BEFORE UPDATE ON public.ai_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed Default Data. NULL organization_id values are distinct in the unique index,
-- so a conflict target would not catch a second global row.
INSERT INTO public.ai_configs (role, system_prompt)
SELECT seed.role, seed.system_prompt
FROM (
    VALUES
        ('client', 'You are a helpful assistant for Client Portal users. Your goal is to help clients manage their account, view invoices, and submit tickets. Use simple, non-technical language.'),
        ('staff', 'You are a technical support assistant. You have access to server logs and technical details. Help staff members troubleshoot client issues efficiently.'),
        ('super_admin', 'You are the system administrator assistant. You have full knowledge of the system architecture, database schema, and server configurations. Provide detailed technical steps.')
) AS seed(role, system_prompt)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.ai_configs existing
    WHERE existing.organization_id IS NULL
      AND existing.role = seed.role
);
