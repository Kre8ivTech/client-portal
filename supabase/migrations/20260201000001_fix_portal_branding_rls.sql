-- Migration: Fix RLS infinite recursion across all tables
-- Description: Replace ALL inline user queries with SECURITY DEFINER functions to prevent
--              infinite RLS recursion (error 42P17).
-- Issue: Many policies use inline subqueries like (SELECT ... FROM public.users WHERE id = auth.uid())
--        which triggers RLS on users, causing infinite recursion.
-- Solution: Use existing SECURITY DEFINER functions: is_super_admin(), get_user_organization_id(),
--           is_admin_or_staff(), plus add get_user_role()
-- Date: 2026-02-01

-- =============================================================================
-- 1. ADD MISSING HELPER FUNCTION: get_user_role()
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- 2. FIX USERS TABLE SELECT POLICY
-- =============================================================================

DROP POLICY IF EXISTS "Users are viewable by org or super admin" ON public.users;

CREATE POLICY "Users are viewable by org or super admin"
  ON public.users FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    OR id = auth.uid()
    OR is_super_admin()
  );

-- =============================================================================
-- 3. FIX PROFILES TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Profiles viewable by org or self or super admin" ON public.profiles;

CREATE POLICY "Profiles viewable by org or self or super admin"
  ON public.profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = profiles.user_id
        AND u.organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =============================================================================
-- 4. FIX PORTAL_BRANDING POLICY
-- =============================================================================

DROP POLICY IF EXISTS "Only super_admin can update portal branding" ON portal_branding;

CREATE POLICY "Only super_admin can update portal branding"
  ON portal_branding FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =============================================================================
-- 5. FIX ORGANIZATIONS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Organizations are viewable by their members" ON organizations;
CREATE POLICY "Organizations are viewable by their members"
  ON organizations FOR SELECT
  USING (
    id = get_user_organization_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Partners can view client organizations" ON organizations;
CREATE POLICY "Partners can view client organizations"
  ON organizations FOR SELECT
  USING (parent_org_id = get_user_organization_id());

-- =============================================================================
-- 6. FIX PAYMENT_TERMS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Payment terms are viewable by organization members" ON payment_terms;
CREATE POLICY "Payment terms are viewable by organization members"
  ON payment_terms FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    OR organization_id IS NULL
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Super admins and staff can manage payment terms" ON payment_terms;
CREATE POLICY "Super admins and staff can manage payment terms"
  ON payment_terms FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- =============================================================================
-- 7. FIX AUDIT_LOGS POLICY
-- =============================================================================

DROP POLICY IF EXISTS "Super admin can view audit logs" ON public.audit_logs;
CREATE POLICY "Super admin can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_super_admin());

-- =============================================================================
-- 8. FIX FORMS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view active forms for their org or system" ON public.forms;
CREATE POLICY "Users can view active forms for their org or system"
  ON public.forms FOR SELECT
  USING (
    (status = 'active' AND (organization_id IS NULL OR organization_id = get_user_organization_id()))
    OR is_admin_or_staff()
  );

DROP POLICY IF EXISTS "Staff can manage forms" ON public.forms;
CREATE POLICY "Staff can manage forms"
  ON public.forms FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

DROP POLICY IF EXISTS "Staff can view form submissions" ON public.form_submissions;
CREATE POLICY "Staff can view form submissions"
  ON public.form_submissions FOR SELECT
  USING (is_admin_or_staff());

DROP POLICY IF EXISTS "Users can submit to active forms" ON public.form_submissions;
CREATE POLICY "Users can submit to active forms"
  ON public.form_submissions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_id AND f.status = 'active'
      AND (f.organization_id IS NULL OR f.organization_id = get_user_organization_id())
    )
  );

DROP POLICY IF EXISTS "Staff can update submission status" ON public.form_submissions;
CREATE POLICY "Staff can update submission status"
  ON public.form_submissions FOR UPDATE
  USING (is_admin_or_staff());

-- =============================================================================
-- 9. FIX TIME_ENTRIES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view time entries in their org" ON public.time_entries;
CREATE POLICY "Staff can view time entries in their org"
  ON public.time_entries FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Staff can insert own time entries" ON public.time_entries;
CREATE POLICY "Staff can insert own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      organization_id = get_user_organization_id()
      OR is_super_admin()
    )
  );

DROP POLICY IF EXISTS "Staff can update time entries in their org" ON public.time_entries;
CREATE POLICY "Staff can update time entries in their org"
  ON public.time_entries FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Staff can delete own time entries" ON public.time_entries;
CREATE POLICY "Staff can delete own time entries"
  ON public.time_entries FOR DELETE
  USING (
    user_id = auth.uid()
    OR organization_id = get_user_organization_id()
    OR is_super_admin()
  );

-- =============================================================================
-- 10. FIX CALENDAR/OFFICE HOURS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view own calendar integrations" ON staff_calendar_integrations;
CREATE POLICY "Staff can view own calendar integrations"
  ON staff_calendar_integrations FOR SELECT
  USING (user_id = auth.uid() OR is_admin_or_staff());

DROP POLICY IF EXISTS "Super admin can view all calendar integrations" ON staff_calendar_integrations;
CREATE POLICY "Super admin can view all calendar integrations"
  ON staff_calendar_integrations FOR SELECT
  USING (is_super_admin());

DROP POLICY IF EXISTS "Staff can view own office hours" ON office_hours;
CREATE POLICY "Staff can view own office hours"
  ON office_hours FOR SELECT
  USING (user_id = auth.uid() OR is_admin_or_staff());

DROP POLICY IF EXISTS "Super admin can view all office hours" ON office_hours;
CREATE POLICY "Super admin can view all office hours"
  ON office_hours FOR SELECT
  USING (is_super_admin());

-- =============================================================================
-- 11. FIX TICKETS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Staff can manage all tickets" ON tickets;
CREATE POLICY "Staff can manage all tickets"
  ON tickets FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

DROP POLICY IF EXISTS "Partners can manage their and client tickets" ON tickets;
CREATE POLICY "Partners can manage their and client tickets"
  ON tickets FOR ALL
  USING (
    organization_id = get_user_organization_id()
    OR organization_id IN (SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id())
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    OR organization_id IN (SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id())
  );

DROP POLICY IF EXISTS "Clients can manage own tickets" ON tickets;
CREATE POLICY "Clients can manage own tickets"
  ON tickets FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- =============================================================================
-- 12. FIX TICKET_COMMENTS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view relevant comments" ON ticket_comments;
CREATE POLICY "Users can view relevant comments"
  ON ticket_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (
        is_admin_or_staff()
        OR t.organization_id = get_user_organization_id()
        OR t.organization_id IN (SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id())
      )
    )
    AND (
      is_internal = FALSE
      OR get_user_role() IN ('staff', 'super_admin', 'partner', 'partner_staff')
    )
  );

DROP POLICY IF EXISTS "Users can create comments on accessible tickets" ON ticket_comments;
CREATE POLICY "Users can create comments on accessible tickets"
  ON ticket_comments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (
        is_admin_or_staff()
        OR t.organization_id = get_user_organization_id()
        OR t.organization_id IN (SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id())
      )
    )
  );

-- =============================================================================
-- 13. FIX KNOWLEDGE BASE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Partner categories are viewable by partners" ON kb_categories;
CREATE POLICY "Partner categories are viewable by partners"
  ON kb_categories FOR SELECT
  USING (get_user_role() IN ('super_admin', 'staff', 'partner'));

DROP POLICY IF EXISTS "Internal categories are viewable by staff" ON kb_categories;
CREATE POLICY "Internal categories are viewable by staff"
  ON kb_categories FOR SELECT
  USING (get_user_role() IN ('super_admin', 'staff'));

DROP POLICY IF EXISTS "Client-specific categories" ON kb_categories;
CREATE POLICY "Client-specific categories"
  ON kb_categories FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    OR get_user_role() IN ('super_admin', 'staff')
  );

DROP POLICY IF EXISTS "Partner articles are viewable by partners" ON kb_articles;
CREATE POLICY "Partner articles are viewable by partners"
  ON kb_articles FOR SELECT
  USING (get_user_role() IN ('super_admin', 'staff', 'partner'));

DROP POLICY IF EXISTS "Internal articles are viewable by staff" ON kb_articles;
CREATE POLICY "Internal articles are viewable by staff"
  ON kb_articles FOR SELECT
  USING (get_user_role() IN ('super_admin', 'staff'));

DROP POLICY IF EXISTS "Client-specific articles" ON kb_articles;
CREATE POLICY "Client-specific articles"
  ON kb_articles FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    OR get_user_role() IN ('super_admin', 'staff')
  );

-- =============================================================================
-- 14. FIX MESSAGING/CHAT POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Conversations access" ON conversations;
CREATE POLICY "Conversations access" ON conversations FOR ALL
  USING (
    auth.uid() = ANY(participant_ids)
    OR get_user_role() IN ('super_admin', 'staff')
  );

DROP POLICY IF EXISTS "Messages access" ON messages;
CREATE POLICY "Messages access" ON messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        auth.uid() = ANY(c.participant_ids)
        OR get_user_role() IN ('super_admin', 'staff')
      )
    )
  );

DROP POLICY IF EXISTS "Chat sessions access" ON chat_sessions;
CREATE POLICY "Chat sessions access" ON chat_sessions FOR ALL
  USING (
    visitor_id = auth.uid()
    OR agent_id = auth.uid()
    OR get_user_role() IN ('super_admin', 'staff')
  );

DROP POLICY IF EXISTS "Chat messages access" ON chat_messages;
CREATE POLICY "Chat messages access" ON chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = chat_messages.session_id
      AND (
        cs.visitor_id = auth.uid()
        OR cs.agent_id = auth.uid()
        OR get_user_role() IN ('super_admin', 'staff')
      )
    )
  );

-- =============================================================================
-- 15. FIX VAULT_ITEMS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view vault items for their organization" ON public.vault_items;
CREATE POLICY "Users can view vault items for their organization" ON public.vault_items FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create vault items for their organization" ON public.vault_items;
CREATE POLICY "Users can create vault items for their organization" ON public.vault_items FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update vault items for their organization" ON public.vault_items;
CREATE POLICY "Users can update vault items for their organization" ON public.vault_items FOR UPDATE
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete vault items for their organization" ON public.vault_items;
CREATE POLICY "Users can delete vault items for their organization" ON public.vault_items FOR DELETE
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- 16. FIX PLAN-RELATED POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their org invoice templates" ON invoice_templates;
CREATE POLICY "Users can view their org invoice templates"
  ON invoice_templates FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Users can view available plans" ON plans;
CREATE POLICY "Users can view available plans"
  ON plans FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Users can view plan coverage items" ON plan_coverage_items;
CREATE POLICY "Users can view plan coverage items"
  ON plan_coverage_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      WHERE p.id = plan_coverage_items.plan_id
      AND (p.organization_id IS NULL OR p.organization_id = get_user_organization_id())
    )
  );

DROP POLICY IF EXISTS "Clients can view their own plan assignments" ON plan_assignments;
CREATE POLICY "Clients can view their own plan assignments"
  ON plan_assignments FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can view their org billing disputes" ON billing_disputes;
CREATE POLICY "Users can view their org billing disputes"
  ON billing_disputes FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create billing disputes" ON billing_disputes;
CREATE POLICY "Users can create billing disputes"
  ON billing_disputes FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can view their renewal notifications" ON plan_renewal_notifications;
CREATE POLICY "Users can view their renewal notifications"
  ON plan_renewal_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = plan_renewal_notifications.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can view their plan hour logs" ON plan_hour_logs;
CREATE POLICY "Users can view their plan hour logs"
  ON plan_hour_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = plan_hour_logs.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can view their overage acceptances" ON overage_acceptances;
CREATE POLICY "Users can view their overage acceptances"
  ON overage_acceptances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_assignments pa
      WHERE pa.id = overage_acceptances.plan_assignment_id
      AND pa.organization_id = get_user_organization_id()
    )
  );
