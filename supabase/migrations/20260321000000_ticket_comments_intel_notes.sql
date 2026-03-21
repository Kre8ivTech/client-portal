-- Intel notes: super-admin-only ticket comments (not visible to staff/partners/clients).

ALTER TABLE public.ticket_comments
  ADD COLUMN IF NOT EXISTS is_intel BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.ticket_comments.is_intel IS
  'Platform intelligence note; visible only to super_admin/admin. Implies internal.';

ALTER TABLE public.ticket_comments
  ADD CONSTRAINT ticket_comments_intel_implies_internal
  CHECK (NOT is_intel OR is_internal IS TRUE);

DROP POLICY IF EXISTS "Users can view relevant comments" ON public.ticket_comments;
CREATE POLICY "Users can view relevant comments"
  ON public.ticket_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND (
          is_admin_or_staff()
          OR t.organization_id = get_user_organization_id()
          OR t.organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id()
          )
        )
    )
    AND (
      (
        COALESCE(ticket_comments.is_intel, FALSE) = FALSE
        AND (
          COALESCE(ticket_comments.is_internal, FALSE) = FALSE
          OR get_user_role() IN ('staff', 'super_admin', 'partner', 'partner_staff', 'admin')
        )
      )
      OR (
        COALESCE(ticket_comments.is_intel, FALSE) = TRUE
        AND is_super_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Users can create comments on accessible tickets" ON public.ticket_comments;
CREATE POLICY "Users can create comments on accessible tickets"
  ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND (
          is_admin_or_staff()
          OR t.organization_id = get_user_organization_id()
          OR t.organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id()
          )
        )
    )
    AND (
      COALESCE(ticket_comments.is_intel, FALSE) = FALSE
      OR is_super_admin()
    )
  );

DROP POLICY IF EXISTS "Authors can update own comments" ON public.ticket_comments;
CREATE POLICY "Authors can update own comments"
  ON public.ticket_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (
    author_id = auth.uid()
    AND (
      COALESCE(is_intel, FALSE) = FALSE
      OR is_super_admin()
    )
  );
