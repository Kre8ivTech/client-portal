-- Restrict ticket deletion to super admins and make optional ticket links non-blocking.

DROP POLICY IF EXISTS "Staff can manage all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Partners can manage their and client tickets" ON public.tickets;
DROP POLICY IF EXISTS "Clients can manage own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Clients can manage organization tickets" ON public.tickets;

CREATE POLICY "Staff can view all tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "Staff can create tickets"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_staff());

CREATE POLICY "Staff can update tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

CREATE POLICY "Partners can create organization tickets"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('partner', 'partner_staff')
    AND (
      organization_id = get_user_organization_id()
      OR organization_id IN (
        SELECT id FROM public.organizations
        WHERE parent_org_id = get_user_organization_id()
      )
    )
  );

CREATE POLICY "Partners can update organization tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('partner', 'partner_staff')
    AND (
      organization_id = get_user_organization_id()
      OR organization_id IN (
        SELECT id FROM public.organizations
        WHERE parent_org_id = get_user_organization_id()
      )
    )
  )
  WITH CHECK (
    get_user_role() IN ('partner', 'partner_staff')
    AND (
      organization_id = get_user_organization_id()
      OR organization_id IN (
        SELECT id FROM public.organizations
        WHERE parent_org_id = get_user_organization_id()
      )
    )
  );

CREATE POLICY "Clients can create organization tickets"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'client'
    AND organization_id = get_user_organization_id()
  );

CREATE POLICY "Clients can update organization tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'client'
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    get_user_role() = 'client'
    AND organization_id = get_user_organization_id()
  );

CREATE POLICY "Super admins can delete tickets"
  ON public.tickets FOR DELETE TO authenticated
  USING (is_super_admin());

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_parent_ticket_id_fkey,
  ADD CONSTRAINT tickets_parent_ticket_id_fkey
    FOREIGN KEY (parent_ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_ticket_id_fkey,
  ADD CONSTRAINT conversations_ticket_id_fkey
    FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;

ALTER TABLE public.chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_converted_ticket_id_fkey,
  ADD CONSTRAINT chat_sessions_converted_ticket_id_fkey
    FOREIGN KEY (converted_ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;
