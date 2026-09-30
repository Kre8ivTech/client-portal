-- The SELECT policy on conversation_participants queried conversation_participants
-- from inside its own RLS check. Postgres reports that as infinite recursion
-- (42P17), and GET /api/conversations then fails. A security-definer helper
-- reads membership without re-entering the policy.

CREATE OR REPLACE FUNCTION public.is_conversation_participant(target_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = target_conversation_id
      AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_conversation_participant(UUID) IS
  'True when the current user has a row in conversation_participants for the conversation. SECURITY DEFINER so the SELECT policy can see co-participants without recursive RLS.';

REVOKE ALL ON FUNCTION public.is_conversation_participant(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view their conversation participants" ON public.conversation_participants;

CREATE POLICY "Users can view their conversation participants"
  ON public.conversation_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
    OR public.is_admin_or_staff()
  );
