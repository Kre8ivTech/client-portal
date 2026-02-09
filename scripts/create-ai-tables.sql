-- Create AI tables that are missing from the database

-- 1. AI Documents table for knowledge base
CREATE TABLE IF NOT EXISTS ai_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    document_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. AI Rules table for custom rules per organization
CREATE TABLE IF NOT EXISTS ai_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    rule_content TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. AI Messages table
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. AI Configs table (unified definition)
CREATE TABLE IF NOT EXISTS ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    system_prompt TEXT NOT NULL DEFAULT 'You are a helpful AI assistant for a client portal.',
    model_params JSONB DEFAULT '{"temperature": 0.7, "max_tokens": 1024}'::jsonb,
    greeting_message TEXT DEFAULT 'Hello! I''m your AI assistant. How can I help you today?',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_documents_org ON ai_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_rules_org ON ai_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_org ON ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_configs_org ON ai_configs(organization_id);

-- RLS
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;

-- AI Documents policies
DO $$ BEGIN
CREATE POLICY "Users can view org documents"
    ON ai_documents FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
        OR organization_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Admins can manage documents"
    ON ai_documents FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'staff')
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI Rules policies
DO $$ BEGIN
CREATE POLICY "Users can view org rules"
    ON ai_rules FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Admins can manage rules"
    ON ai_rules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'staff')
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI Conversations policies
DO $$ BEGIN
CREATE POLICY "Users can view own conversations"
    ON ai_conversations FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can create own conversations"
    ON ai_conversations FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI Messages policies
DO $$ BEGIN
CREATE POLICY "Users can view messages in their conversations"
    ON ai_messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM ai_conversations WHERE user_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can create messages in their conversations"
    ON ai_messages FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM ai_conversations WHERE user_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI Configs policies
DO $$ BEGIN
CREATE POLICY "Users can view active configs"
    ON ai_configs FOR SELECT
    USING (
        is_active = true
        AND (
            organization_id IS NULL
            OR organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Admins can manage configs"
    ON ai_configs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'staff')
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed default global AI config
INSERT INTO ai_configs (id, organization_id, system_prompt, greeting_message)
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
- Help users find the right place in the portal for their needs',
    'Hello! I''m your AI assistant. I can help you with questions about your projects, services, invoices, contracts, and more. How can I help you today?'
)
ON CONFLICT (id) DO NOTHING;
