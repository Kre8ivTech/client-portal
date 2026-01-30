-- ============================================
-- CONVERSATIONS & MESSAGES
-- ============================================

-- Conversations table for async communication
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    type VARCHAR(30) NOT NULL
        CHECK (type IN ('direct', 'group', 'support', 'project', 'internal')),
    
    title VARCHAR(255),
    
    -- Related entities
    ticket_id UUID REFERENCES tickets(id),
    
    -- Participants (Array of profile IDs)
    participant_ids UUID[] NOT NULL DEFAULT '{}',
    
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id),
    
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text'
        CHECK (message_type IN ('text', 'file', 'system', 'action')),
    
    attachments JSONB DEFAULT '[]',
    
    -- Read tracking
    read_by JSONB DEFAULT '[]',
    -- [{ "user_id": "...", "read_at": "..." }]
    
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- ============================================
-- LIVE CHAT
-- ============================================

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Visitor (can be anonymous or user)
    visitor_id UUID REFERENCES profiles(id),
    visitor_name VARCHAR(255),
    visitor_email VARCHAR(255),
    
    -- Agent
    agent_id UUID REFERENCES profiles(id),
    
    -- Pre-chat data
    pre_chat_data JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'active', 'ended', 'missed')),
    
    -- Queue
    queue_position INTEGER,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    
    -- Satisfaction
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    satisfaction_comment TEXT,
    
    -- Conversion
    converted_ticket_id UUID REFERENCES tickets(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    sender_type VARCHAR(20) NOT NULL
        CHECK (sender_type IN ('visitor', 'agent', 'system', 'bot')),
    sender_id UUID, -- References profiles if sender_type is agent or visitor is logged in
    
    content TEXT NOT NULL,
    
    -- Internal notes (whisper)
    is_internal BOOLEAN DEFAULT FALSE,
    
    attachments JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: Particpants and Staff
CREATE POLICY "Conversations access" ON conversations
    FOR ALL
    USING (
        auth.uid() = ANY(participant_ids)
        OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff')
    );

-- Messages: Access if you can see the conversation
CREATE POLICY "Messages access" ON messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE id = messages.conversation_id 
            AND (
                auth.uid() = ANY(participant_ids)
                OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff')
            )
        )
    );

-- Chat Sessions: Visitor, Agent, or Staff
CREATE POLICY "Chat sessions access" ON chat_sessions
    FOR ALL
    USING (
        visitor_id = auth.uid()
        OR agent_id = auth.uid()
        OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff')
    );

-- Chat Messages: If you can see the session
CREATE POLICY "Chat messages access" ON chat_messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = chat_messages.session_id 
            AND (
                visitor_id = auth.uid()
                OR agent_id = auth.uid()
                OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff')
            )
        )
    );

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to update last_message_at on conversations
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_created
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Enable Realtime for Messaging
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
