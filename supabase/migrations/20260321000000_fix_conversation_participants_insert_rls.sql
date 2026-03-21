-- Backfill INSERT policy for conversation_participants (non-staff must add the other
-- participant row when creating a direct chat). Idempotent: DROP + CREATE.
--
-- If you see "relation conversation_participants does not exist", this migration is
-- running before the table exists. Apply 20260203000005_conversation_participants.sql
-- first (or run `supabase db push` / `supabase migration up` so migrations run in order).

DO $body$
BEGIN
  IF to_regclass('public.conversation_participants') IS NOT NULL THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "Users can join conversations they create" ON public.conversation_participants
    $sql$;

    EXECUTE $sql$
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
        )
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping conversation_participants RLS fix: table missing. Apply 20260203000005_conversation_participants.sql first.';
  END IF;
END
$body$;
