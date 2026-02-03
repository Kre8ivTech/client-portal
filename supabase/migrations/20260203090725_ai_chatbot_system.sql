-- AI Documents table for knowledge base
CREATE TABLE IF NOT EXISTS ai_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    document_type TEXT NOT NULL, -- 'faq', 'documentation', 'policy', 'custom'
    metadata JSONB DEFAULT '{}',
    embedding vector(1536), -- For semantic search
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- AI Rules table for custom rules per organization
CREATE TABLE IF NOT EXISTS ai_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    rule_content TEXT NOT NULL,
    priority INTEGER DEFAULT 0, -- Higher priority rules are applied first
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Messages table
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_documents_org ON ai_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_rules_org ON ai_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_org ON ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);

-- RLS Policies
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- AI Documents policies
CREATE POLICY "Users can view org documents"
    ON ai_documents FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
        OR organization_id IS NULL -- Global documents
    );

CREATE POLICY "Admins can manage documents"
    ON ai_documents FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'staff')
        )
    );

-- AI Rules policies
CREATE POLICY "Users can view org rules"
    ON ai_rules FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage rules"
    ON ai_rules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'staff')
        )
    );

-- AI Conversations policies
CREATE POLICY "Users can view own conversations"
    ON ai_conversations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create own conversations"
    ON ai_conversations FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- AI Messages policies
CREATE POLICY "Users can view messages in their conversations"
    ON ai_messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM ai_conversations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in their conversations"
    ON ai_messages FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM ai_conversations WHERE user_id = auth.uid()
        )
    );
