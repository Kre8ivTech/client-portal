-- AI Configuration table for system prompts and model settings
-- This table was referenced in the API but not created in original migration

CREATE TABLE IF NOT EXISTS ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    system_prompt TEXT NOT NULL DEFAULT 'You are a helpful AI assistant for a client portal. You help users with questions about services, projects, invoices, contracts, and general support. Be friendly, professional, and concise.',
    model_params JSONB DEFAULT '{
        "temperature": 0.7,
        "max_tokens": 1024
    }'::jsonb,
    greeting_message TEXT DEFAULT 'Hello! I''m your AI assistant. How can I help you today?',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create a default global config if none exists
INSERT INTO ai_configs (id, organization_id, system_prompt)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    NULL,
    'You are a helpful AI assistant for the KT-Portal client management system. You help users with:

- Support tickets and service requests
- Projects and deliverables
- Invoices and billing questions
- Contracts and agreements
- General navigation and portal features

Guidelines:
- Be friendly, professional, and concise
- If you don''t know something, say so honestly
- For account-specific questions, suggest contacting support
- Never share sensitive information or make up answers
- Help users find the right place in the portal for their needs'
)
ON CONFLICT (id) DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_ai_configs_org ON ai_configs(organization_id);

-- RLS
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active configs
DROP POLICY IF EXISTS "Users can view active configs" ON ai_configs;
CREATE POLICY "Users can view active configs"
    ON ai_configs FOR SELECT
    USING (
        is_active = true
        AND (
            organization_id IS NULL -- Global config
            OR organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
        )
    );

-- Admins can manage configs
DROP POLICY IF EXISTS "Admins can manage configs" ON ai_configs;
CREATE POLICY "Admins can manage configs"
    ON ai_configs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'staff')
        )
    );

COMMENT ON TABLE ai_configs IS 'AI chatbot configuration including system prompts and model parameters';
