-- Fix INSERT on conversation_participants: non-staff users must be able to add the *other*
-- participant row when creating a direct chat (both IDs are already on conversations.participant_ids).
-- Previous policy only allowed user_id = auth.uid() OR staff, so the recipient row failed with
-- "Failed to add participants".

DROP POLICY IF EXISTS "Users can join conversations they create" ON public.conversation_participants;

CREATE POLICY "Users can join conversations they create" ON public.conversation_participants
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'staff', 'admin')
        OR (
            EXISTS (
                SELECT 1 FROM public.conversations c
                WHERE c.id = conversation_participants.conversation_id
                AND auth.uid() = ANY(c.participant_ids)
                AND conversation_participants.user_id = ANY(c.participant_ids)
            )
        )
    );
