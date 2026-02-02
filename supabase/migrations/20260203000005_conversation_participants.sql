-- Migration: Conversation Participants Join Table
-- Description: Creates a proper join table for conversation participants to enable proper
-- joins and fetch participant profile data. Also adds last_message_content to conversations.
-- Date: 2026-02-03

-- ============================================
-- 1. CREATE CONVERSATION PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE,
    is_muted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);

-- ============================================
-- 2. ADD LAST MESSAGE CONTENT TO CONVERSATIONS
-- ============================================
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_message_content TEXT;

-- ============================================
-- 3. MIGRATE EXISTING PARTICIPANT DATA
-- ============================================
-- Insert existing participants from the participant_ids array
INSERT INTO conversation_participants (conversation_id, user_id)
SELECT c.id, unnest(c.participant_ids)
FROM conversations c
WHERE array_length(c.participant_ids, 1) > 0
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- ============================================
-- 4. RLS FOR CONVERSATION PARTICIPANTS
-- ============================================
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversation participants" ON conversation_participants
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM conversation_participants cp2
            WHERE cp2.conversation_id = conversation_participants.conversation_id
            AND cp2.user_id = auth.uid()
        )
        OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'staff')
    );

CREATE POLICY "Users can join conversations they create" ON conversation_participants
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'staff')
    );

CREATE POLICY "Users can update own participation" ON conversation_participants
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave conversations" ON conversation_participants
    FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- 5. UPDATE TRIGGER FOR LAST MESSAGE CONTENT
-- ============================================
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at,
        last_message_content = NEW.content,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger already exists, this just updates the function

-- ============================================
-- 6. HELPER FUNCTION TO CHECK IF USER CAN START CONVERSATION
-- ============================================
CREATE OR REPLACE FUNCTION can_message_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_org_id UUID;
    target_org_id UUID;
    current_role TEXT;
BEGIN
    -- Get current user's org and role
    SELECT organization_id, role INTO current_org_id, current_role
    FROM public.users
    WHERE id = auth.uid();

    -- Get target user's org
    SELECT organization_id INTO target_org_id
    FROM public.users
    WHERE id = target_user_id;

    -- Super admins and staff can message anyone
    IF current_role IN ('super_admin', 'staff') THEN
        RETURN TRUE;
    END IF;

    -- Users in the same organization can message each other
    IF current_org_id = target_org_id THEN
        RETURN TRUE;
    END IF;

    -- Partners can message their client organizations
    IF current_role IN ('partner', 'partner_staff') THEN
        IF EXISTS (
            SELECT 1 FROM organizations
            WHERE id = target_org_id
            AND parent_org_id = current_org_id
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Clients can message their partner organization
    IF EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = current_org_id
        AND o.parent_org_id = target_org_id
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 7. FUNCTION TO FIND OR CREATE DIRECT CONVERSATION
-- ============================================
CREATE OR REPLACE FUNCTION find_or_create_direct_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    conv_id UUID;
    current_user_id UUID := auth.uid();
BEGIN
    -- Check if can message the user
    IF NOT can_message_user(other_user_id) THEN
        RAISE EXCEPTION 'You are not allowed to message this user';
    END IF;

    -- Find existing direct conversation
    SELECT cp1.conversation_id INTO conv_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    JOIN conversations c ON c.id = cp1.conversation_id
    WHERE cp1.user_id = current_user_id
    AND cp2.user_id = other_user_id
    AND c.type = 'direct'
    LIMIT 1;

    -- If no conversation exists, create one
    IF conv_id IS NULL THEN
        INSERT INTO conversations (organization_id, type, participant_ids)
        SELECT u.organization_id, 'direct', ARRAY[current_user_id, other_user_id]
        FROM users u
        WHERE u.id = current_user_id
        RETURNING id INTO conv_id;

        -- Add both participants
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (conv_id, current_user_id), (conv_id, other_user_id);
    END IF;

    RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. UPDATE CONVERSATIONS POLICY FOR PARTICIPANTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Conversations access" ON conversations;
CREATE POLICY "Conversations access" ON conversations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = conversations.id
            AND cp.user_id = auth.uid()
        )
        OR auth.uid() = ANY(participant_ids)
        OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'staff')
    );

-- ============================================
-- 9. ENABLE REALTIME FOR NEW TABLE
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
