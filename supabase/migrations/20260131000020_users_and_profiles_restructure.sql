-- Migration: Users table + Profiles restructure
-- Description: Add public.users (identity, role, org), make profiles 1:1 extended profile only
-- Date: 2026-01-31
--
-- Model (no redundancy):
--   organizations: tenants; parent_org_id for hierarchy (partner -> client). No user data.
--   users: identity + org + role (id=auth.users.id, organization_id, email, role, status). Single source for org/role.
--   profiles: extended display/preferences only (user_id PK, name, avatar_url, notification_preferences, presence). 1:1 with users.
--   user_profiles: VIEW joining users + profiles + organizations for app convenience.
-- =============================================================================
-- 1. CREATE USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'client' CHECK (
    role IN (
      'super_admin',
      'staff',
      'partner',
      'partner_staff',
      'client'
    )
  ),
  status VARCHAR(20) DEFAULT 'active' CHECK (
    status IN ('active', 'inactive', 'invited', 'suspended')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_organization ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE
UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =============================================================================
-- 2. RENAME OLD PROFILES -> PROFILES_LEGACY, CREATE NEW PROFILES
-- =============================================================================
ALTER TABLE IF EXISTS public.profiles
  RENAME TO profiles_legacy;
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  avatar_url VARCHAR(500),
  notification_preferences JSONB DEFAULT '{}',
  presence_status VARCHAR(20) DEFAULT 'offline' CHECK (
    presence_status IN ('online', 'offline', 'away', 'dnd')
  ),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE
UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =============================================================================
-- 3. MIGRATE DATA: profiles_legacy -> users + profiles
-- =============================================================================
INSERT INTO public.users (
    id,
    organization_id,
    email,
    role,
    status,
    created_at,
    updated_at
  )
SELECT id,
  organization_id,
  email,
  role,
  COALESCE(status, 'active'),
  created_at,
  updated_at
FROM public.profiles_legacy ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (
    user_id,
    name,
    avatar_url,
    notification_preferences,
    presence_status,
    last_seen_at,
    created_at,
    updated_at
  )
SELECT id,
  name,
  avatar_url,
  COALESCE(notification_preferences, '{}'),
  COALESCE(presence_status, 'offline'),
  last_seen_at,
  created_at,
  updated_at
FROM public.profiles_legacy ON CONFLICT (user_id) DO NOTHING;
-- NOTE: Do NOT drop profiles_legacy here. Drop it at the end after all policies and FKs are updated.
-- =============================================================================
-- 3b. VIEW: user_profiles (profile + org display only; no duplicate of users)
--     Distinct from users: users = identity/org/role; user_profiles = display fields only.
--     App joins users + user_profiles when both identity and display are needed.
-- =============================================================================
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT u.id,
  p.name,
  p.avatar_url,
  p.notification_preferences,
  p.presence_status,
  p.last_seen_at,
  o.name AS organization_name,
  o.slug AS organization_slug
FROM public.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.organizations o ON o.id = u.organization_id;
-- RLS on view: use underlying tables (view is not security barrier by default)
ALTER VIEW public.user_profiles
SET (security_invoker = true);
-- =============================================================================
-- 4. AUTH TRIGGER: create users + profiles on signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO public.users (id, email)
VALUES (NEW.id, NEW.email);
INSERT INTO public.profiles (user_id, name, avatar_url)
VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- =============================================================================
-- 5. UPDATE HELPER: is_super_admin() to use users
-- =============================================================================
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
  ) $$ LANGUAGE sql SECURITY DEFINER STABLE;
-- Update plans RLS helpers to use users (profiles table no longer has id/organization_id/role)
CREATE OR REPLACE FUNCTION get_user_organization_id() RETURNS UUID AS $$
SELECT organization_id
FROM public.users
WHERE id = auth.uid() $$ LANGUAGE sql SECURITY DEFINER STABLE;
CREATE OR REPLACE FUNCTION get_user_organization_type() RETURNS TEXT AS $$
SELECT o.type::text
FROM public.users u
  JOIN organizations o ON o.id = u.organization_id
WHERE u.id = auth.uid() $$ LANGUAGE sql SECURITY DEFINER STABLE;
CREATE OR REPLACE FUNCTION is_kre8ivtech_user() RETURNS BOOLEAN AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.users u
      JOIN organizations o ON o.id = u.organization_id
    WHERE u.id = auth.uid()
      AND o.type = 'kre8ivtech'
  ) $$ LANGUAGE sql SECURITY DEFINER STABLE;
CREATE OR REPLACE FUNCTION is_admin_or_staff() RETURNS BOOLEAN AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
  ) $$ LANGUAGE sql SECURITY DEFINER STABLE;
-- is_partner_client(client_org_id) uses get_user_organization_id() so no change needed
-- =============================================================================
-- 6. RLS: USERS
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users are viewable by org or super admin" ON public.users FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR id = auth.uid()
    OR is_super_admin()
  );
CREATE POLICY "Users can update own user row" ON public.users FOR
UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Super admins can manage all users" ON public.users FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
-- =============================================================================
-- 7. RLS: PROFILES
-- =============================================================================
CREATE POLICY "Profiles viewable by org or self or super admin" ON public.profiles FOR
SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = profiles.user_id
        AND (
          u.organization_id = (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
          )
          OR is_super_admin()
        )
    )
  );
CREATE POLICY "Users can update own profile" ON public.profiles FOR
UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Super admins can manage all profiles" ON public.profiles FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
-- =============================================================================
-- 8. UPDATE OTHER TABLE POLICIES: profiles -> users
-- =============================================================================
-- Organizations
DROP POLICY IF EXISTS "Organizations are viewable by their members" ON organizations;
CREATE POLICY "Organizations are viewable by their members" ON organizations FOR
SELECT USING (
    id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR is_super_admin()
  );
-- Payment terms
DROP POLICY IF EXISTS "Payment terms are viewable by organization members" ON payment_terms;
CREATE POLICY "Payment terms are viewable by organization members" ON payment_terms FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR organization_id IS NULL
    OR is_super_admin()
  );
DROP POLICY IF EXISTS "Super admins and staff can manage payment terms" ON payment_terms;
CREATE POLICY "Super admins and staff can manage payment terms" ON payment_terms FOR ALL USING (
  is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'staff'
  )
) WITH CHECK (
  is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'staff'
  )
);
-- =============================================================================
-- 9. FK UPDATES: point user/profile columns to users(id)
-- =============================================================================
-- audit_logs: profile_id -> user_id, ref users(id)
ALTER TABLE public.audit_logs
  RENAME COLUMN profile_id TO user_id;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_profile_id_fkey;
ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE
SET NULL;
-- form_submissions: profile_id -> user_id
ALTER TABLE public.form_submissions
  RENAME COLUMN profile_id TO user_id;
ALTER TABLE public.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_profile_id_fkey;
ALTER TABLE public.form_submissions
ADD CONSTRAINT form_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE
SET NULL;
-- time_entries: profile_id -> user_id
ALTER TABLE public.time_entries
  RENAME COLUMN profile_id TO user_id;
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_profile_id_fkey;
ALTER TABLE public.time_entries
ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
-- staff_calendar_integrations: profile_id -> user_id
ALTER TABLE public.staff_calendar_integrations
  RENAME COLUMN profile_id TO user_id;
ALTER TABLE public.staff_calendar_integrations DROP CONSTRAINT IF EXISTS staff_calendar_integrations_profile_id_fkey;
ALTER TABLE public.staff_calendar_integrations
ADD CONSTRAINT staff_calendar_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
-- office_hours: profile_id -> user_id
ALTER TABLE public.office_hours
  RENAME COLUMN profile_id TO user_id;
ALTER TABLE public.office_hours DROP CONSTRAINT IF EXISTS office_hours_profile_id_fkey;
ALTER TABLE public.office_hours
ADD CONSTRAINT office_hours_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
-- kb_articles: author_id ref users(id)
ALTER TABLE public.kb_articles DROP CONSTRAINT IF EXISTS kb_articles_author_id_fkey;
ALTER TABLE public.kb_articles
ADD CONSTRAINT kb_articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);
-- messages: sender_id ref users(id)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
-- chat_sessions: visitor_id, agent_id ref users(id)
ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_visitor_id_fkey;
ALTER TABLE public.chat_sessions
ADD CONSTRAINT chat_sessions_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.users(id);
ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_agent_id_fkey;
ALTER TABLE public.chat_sessions
ADD CONSTRAINT chat_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id);
-- ticket_comments: author_id ref users(id)
ALTER TABLE public.ticket_comments DROP CONSTRAINT IF EXISTS ticket_comments_author_id_fkey;
ALTER TABLE public.ticket_comments
ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;
-- tickets: created_by, assigned_to ref users(id)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_created_by_fkey;
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);
-- vault_items: created_by ref users(id)
ALTER TABLE public.vault_items DROP CONSTRAINT IF EXISTS vault_items_created_by_fkey;
ALTER TABLE public.vault_items
ADD CONSTRAINT vault_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
-- forms: created_by ref users(id)
ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_created_by_fkey;
ALTER TABLE public.forms
ADD CONSTRAINT forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
-- Plan tables: plan_assignments only has cancellation_requested_by and cancelled_by (not submitted_by, etc.)
ALTER TABLE public.plan_assignments DROP CONSTRAINT IF EXISTS plan_assignments_cancellation_requested_by_fkey;
ALTER TABLE public.plan_assignments
ADD CONSTRAINT plan_assignments_cancellation_requested_by_fkey FOREIGN KEY (cancellation_requested_by) REFERENCES public.users(id);
ALTER TABLE public.plan_assignments DROP CONSTRAINT IF EXISTS plan_assignments_cancelled_by_fkey;
ALTER TABLE public.plan_assignments
ADD CONSTRAINT plan_assignments_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);
-- billing_disputes: submitted_by, resolved_by
ALTER TABLE public.billing_disputes DROP CONSTRAINT IF EXISTS billing_disputes_submitted_by_fkey;
ALTER TABLE public.billing_disputes
ADD CONSTRAINT billing_disputes_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);
-- Plan tables: billing_disputes.resolved_by, plan_renewal_notifications, overage_acceptances
ALTER TABLE public.billing_disputes DROP CONSTRAINT IF EXISTS billing_disputes_resolved_by_fkey;
ALTER TABLE public.billing_disputes
ADD CONSTRAINT billing_disputes_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);
ALTER TABLE public.plan_renewal_notifications DROP CONSTRAINT IF EXISTS plan_renewal_notifications_acknowledged_by_fkey;
ALTER TABLE public.plan_renewal_notifications
ADD CONSTRAINT plan_renewal_notifications_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);
ALTER TABLE public.overage_acceptances DROP CONSTRAINT IF EXISTS overage_acceptances_requested_by_fkey;
ALTER TABLE public.overage_acceptances
ADD CONSTRAINT overage_acceptances_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);
ALTER TABLE public.overage_acceptances DROP CONSTRAINT IF EXISTS overage_acceptances_accepted_by_fkey;
ALTER TABLE public.overage_acceptances
ADD CONSTRAINT overage_acceptances_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id);
ALTER TABLE public.overage_acceptances DROP CONSTRAINT IF EXISTS overage_acceptances_invoice_approved_by_fkey;
ALTER TABLE public.overage_acceptances
ADD CONSTRAINT overage_acceptances_invoice_approved_by_fkey FOREIGN KEY (invoice_approved_by) REFERENCES public.users(id);
-- =============================================================================
-- 10. DROP ALL RLS POLICIES THAT REFERENCE profiles_legacy, RECREATE USING users
--     (Must happen before DROP TABLE profiles_legacy)
-- =============================================================================
-- Audit logs
DROP POLICY IF EXISTS "Super admin can view audit logs" ON public.audit_logs;
CREATE POLICY "Super admin can view audit logs" ON public.audit_logs FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );
-- Forms
DROP POLICY IF EXISTS "Users can view active forms for their org or system" ON public.forms;
CREATE POLICY "Users can view active forms for their org or system" ON public.forms FOR
SELECT USING (
    (
      status = 'active'
      AND (
        organization_id IS NULL
        OR organization_id = (
          SELECT organization_id
          FROM public.users
          WHERE id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
  );
DROP POLICY IF EXISTS "Staff can manage forms" ON public.forms;
CREATE POLICY "Staff can manage forms" ON public.forms FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
  )
);
DROP POLICY IF EXISTS "Staff can view form submissions" ON public.form_submissions;
CREATE POLICY "Staff can view form submissions" ON public.form_submissions FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.users p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'staff')
    )
  );
DROP POLICY IF EXISTS "Users can submit to active forms" ON public.form_submissions;
CREATE POLICY "Users can submit to active forms" ON public.form_submissions FOR
INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.forms f
      WHERE f.id = form_id
        AND f.status = 'active'
        AND (
          f.organization_id IS NULL
          OR f.organization_id = (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
          )
        )
    )
  );
DROP POLICY IF EXISTS "Staff can update submission status" ON public.form_submissions;
CREATE POLICY "Staff can update submission status" ON public.form_submissions FOR
UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
  );
-- Time entries
DROP POLICY IF EXISTS "Staff can view time entries in their org" ON public.time_entries;
CREATE POLICY "Staff can view time entries in their org" ON public.time_entries FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );
DROP POLICY IF EXISTS "Staff can insert own time entries" ON public.time_entries;
CREATE POLICY "Staff can insert own time entries" ON public.time_entries FOR
INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      organization_id = (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = auth.uid()
          AND role = 'super_admin'
      )
    )
  );
DROP POLICY IF EXISTS "Staff can update time entries in their org" ON public.time_entries;
CREATE POLICY "Staff can update time entries in their org" ON public.time_entries FOR
UPDATE USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );
DROP POLICY IF EXISTS "Staff can delete own time entries" ON public.time_entries;
CREATE POLICY "Staff can delete own time entries" ON public.time_entries FOR DELETE USING (
  user_id = auth.uid()
  OR organization_id = (
    SELECT organization_id
    FROM public.users
    WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
  )
);
-- Portal branding
DROP POLICY IF EXISTS "Only super_admin can update portal branding" ON portal_branding;
CREATE POLICY "Only super_admin can update portal branding" ON portal_branding FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
  )
);
-- Staff calendar & office hours
DROP POLICY IF EXISTS "Staff can view own calendar integrations" ON staff_calendar_integrations;
CREATE POLICY "Staff can view own calendar integrations" ON staff_calendar_integrations FOR
SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('staff', 'super_admin')
    )
  );
DROP POLICY IF EXISTS "Super admin can view all calendar integrations" ON staff_calendar_integrations;
CREATE POLICY "Super admin can view all calendar integrations" ON staff_calendar_integrations FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );
DROP POLICY IF EXISTS "Staff can view own office hours" ON office_hours;
CREATE POLICY "Staff can view own office hours" ON office_hours FOR
SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('staff', 'super_admin')
    )
  );
DROP POLICY IF EXISTS "Super admin can view all office hours" ON office_hours;
CREATE POLICY "Super admin can view all office hours" ON office_hours FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );
-- Partners view client organizations
DROP POLICY IF EXISTS "Partners can view client organizations" ON organizations;
CREATE POLICY "Partners can view client organizations" ON organizations FOR
SELECT USING (
    parent_org_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
-- Ticket comments
DROP POLICY IF EXISTS "Users can view relevant comments" ON ticket_comments;
CREATE POLICY "Users can view relevant comments" ON ticket_comments FOR
SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users p
            WHERE p.id = auth.uid()
              AND p.role IN ('staff', 'super_admin')
          )
          OR t.organization_id IN (
            SELECT id
            FROM organizations
            WHERE id IN (
                SELECT organization_id
                FROM public.users
                WHERE id = auth.uid()
              )
              OR parent_org_id IN (
                SELECT organization_id
                FROM public.users
                WHERE id = auth.uid()
              )
          )
          OR t.organization_id IN (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
          )
        )
    )
    AND (
      is_internal = FALSE
      OR EXISTS (
        SELECT 1
        FROM public.users p
        WHERE p.id = auth.uid()
          AND p.role IN (
            'staff',
            'super_admin',
            'partner',
            'partner_staff'
          )
      )
    )
  );
DROP POLICY IF EXISTS "Users can create comments on accessible tickets" ON ticket_comments;
CREATE POLICY "Users can create comments on accessible tickets" ON ticket_comments FOR
INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users p
            WHERE p.id = auth.uid()
              AND p.role IN ('staff', 'super_admin')
          )
          OR t.organization_id IN (
            SELECT id
            FROM organizations
            WHERE id IN (
                SELECT organization_id
                FROM public.users
                WHERE id = auth.uid()
              )
              OR parent_org_id IN (
                SELECT organization_id
                FROM public.users
                WHERE id = auth.uid()
              )
          )
          OR t.organization_id IN (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
          )
        )
    )
  );
DROP POLICY IF EXISTS "Authors can update own comments" ON ticket_comments;
CREATE POLICY "Authors can update own comments" ON ticket_comments FOR
UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
-- Tickets
DROP POLICY IF EXISTS "Staff can manage all tickets" ON tickets;
CREATE POLICY "Staff can manage all tickets" ON tickets FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('staff', 'super_admin')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('staff', 'super_admin')
  )
);
DROP POLICY IF EXISTS "Partners can manage their and client tickets" ON tickets;
CREATE POLICY "Partners can manage their and client tickets" ON tickets FOR ALL USING (
  organization_id IN (
    SELECT organization_id
    FROM public.users
    WHERE id = auth.uid()
  )
  OR organization_id IN (
    SELECT id
    FROM organizations
    WHERE parent_org_id IN (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
  )
) WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.users
    WHERE id = auth.uid()
  )
  OR organization_id IN (
    SELECT id
    FROM organizations
    WHERE parent_org_id IN (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
  )
);
DROP POLICY IF EXISTS "Clients can manage own tickets" ON tickets;
CREATE POLICY "Clients can manage own tickets" ON tickets FOR ALL USING (
  organization_id = (
    SELECT organization_id
    FROM public.users
    WHERE id = auth.uid()
  )
) WITH CHECK (
  organization_id = (
    SELECT organization_id
    FROM public.users
    WHERE id = auth.uid()
  )
);
-- Knowledge base
DROP POLICY IF EXISTS "Partner categories are viewable by partners" ON kb_categories;
CREATE POLICY "Partner categories are viewable by partners" ON kb_categories FOR
SELECT USING (
    (
      SELECT role
      FROM public.users
      WHERE id = auth.uid()
    ) IN ('super_admin', 'staff', 'partner')
  );
DROP POLICY IF EXISTS "Internal categories are viewable by staff" ON kb_categories;
CREATE POLICY "Internal categories are viewable by staff" ON kb_categories FOR
SELECT USING (
    (
      SELECT role
      FROM public.users
      WHERE id = auth.uid()
    ) IN ('super_admin', 'staff')
  );
DROP POLICY IF EXISTS "Client-specific categories" ON kb_categories;
CREATE POLICY "Client-specific categories" ON kb_categories FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR (
      SELECT role
      FROM public.users
      WHERE id = auth.uid()
    ) IN ('super_admin', 'staff')
  );
DROP POLICY IF EXISTS "Partner articles are viewable by partners" ON kb_articles;
CREATE POLICY "Partner articles are viewable by partners" ON kb_articles FOR
SELECT USING (
    (
      SELECT role
      FROM public.users
      WHERE id = auth.uid()
    ) IN ('super_admin', 'staff', 'partner')
  );
DROP POLICY IF EXISTS "Internal articles are viewable by staff" ON kb_articles;
CREATE POLICY "Internal articles are viewable by staff" ON kb_articles FOR
SELECT USING (
    (
      SELECT role
      FROM public.users
      WHERE id = auth.uid()
    ) IN ('super_admin', 'staff')
  );
DROP POLICY IF EXISTS "Client-specific articles" ON kb_articles;
CREATE POLICY "Client-specific articles" ON kb_articles FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR (
      SELECT role
      FROM public.users
      WHERE id = auth.uid()
    ) IN ('super_admin', 'staff')
  );
-- Messaging & chat
DROP POLICY IF EXISTS "Conversations access" ON conversations;
CREATE POLICY "Conversations access" ON conversations FOR ALL USING (
  auth.uid() = ANY(participant_ids)
  OR (
    SELECT role
    FROM public.users
    WHERE id = auth.uid()
  ) IN ('super_admin', 'staff')
);
DROP POLICY IF EXISTS "Messages access" ON messages;
CREATE POLICY "Messages access" ON messages FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (
        auth.uid() = ANY(c.participant_ids)
        OR (
          SELECT role
          FROM public.users
          WHERE id = auth.uid()
        ) IN ('super_admin', 'staff')
      )
  )
);
DROP POLICY IF EXISTS "Chat sessions access" ON chat_sessions;
CREATE POLICY "Chat sessions access" ON chat_sessions FOR ALL USING (
  visitor_id = auth.uid()
  OR agent_id = auth.uid()
  OR (
    SELECT role
    FROM public.users
    WHERE id = auth.uid()
  ) IN ('super_admin', 'staff')
);
DROP POLICY IF EXISTS "Chat messages access" ON chat_messages;
CREATE POLICY "Chat messages access" ON chat_messages FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM chat_sessions cs
    WHERE cs.id = chat_messages.session_id
      AND (
        cs.visitor_id = auth.uid()
        OR cs.agent_id = auth.uid()
        OR (
          SELECT role
          FROM public.users
          WHERE id = auth.uid()
        ) IN ('super_admin', 'staff')
      )
  )
);
-- Vault items
DROP POLICY IF EXISTS "Users can view vault items for their organization" ON public.vault_items;
CREATE POLICY "Users can view vault items for their organization" ON public.vault_items FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can create vault items for their organization" ON public.vault_items;
CREATE POLICY "Users can create vault items for their organization" ON public.vault_items FOR
INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can update vault items for their organization" ON public.vault_items;
CREATE POLICY "Users can update vault items for their organization" ON public.vault_items FOR
UPDATE USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can delete vault items for their organization" ON public.vault_items;
CREATE POLICY "Users can delete vault items for their organization" ON public.vault_items FOR DELETE USING (
  organization_id = (
    SELECT organization_id
    FROM public.users
    WHERE id = auth.uid()
  )
);
-- Plan-related policies (use users for org/role)
CREATE OR REPLACE FUNCTION is_admin_or_staff() RETURNS BOOLEAN AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
  ) $$ LANGUAGE sql SECURITY DEFINER STABLE;
DROP POLICY IF EXISTS "Users can view their org invoice templates" ON invoice_templates;
CREATE POLICY "Users can view their org invoice templates" ON invoice_templates FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR organization_id IS NULL
  );
DROP POLICY IF EXISTS "Users can view available plans" ON plans;
CREATE POLICY "Users can view available plans" ON plans FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR organization_id IS NULL
  );
DROP POLICY IF EXISTS "Users can view plan coverage items" ON plan_coverage_items;
CREATE POLICY "Users can view plan coverage items" ON plan_coverage_items FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_coverage_items.plan_id
        AND (
          p.organization_id IS NULL
          OR p.organization_id = (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
          )
        )
    )
  );
DROP POLICY IF EXISTS "Clients can view their own plan assignments" ON plan_assignments;
CREATE POLICY "Clients can view their own plan assignments" ON plan_assignments FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can view their org billing disputes" ON billing_disputes;
CREATE POLICY "Users can view their org billing disputes" ON billing_disputes FOR
SELECT USING (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can create billing disputes" ON billing_disputes;
CREATE POLICY "Users can create billing disputes" ON billing_disputes FOR
INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can view their renewal notifications" ON plan_renewal_notifications;
CREATE POLICY "Users can view their renewal notifications" ON plan_renewal_notifications FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM plan_assignments pa
      WHERE pa.id = plan_renewal_notifications.plan_assignment_id
        AND pa.organization_id = (
          SELECT organization_id
          FROM public.users
          WHERE id = auth.uid()
        )
    )
  );
DROP POLICY IF EXISTS "Users can view their plan hour logs" ON plan_hour_logs;
CREATE POLICY "Users can view their plan hour logs" ON plan_hour_logs FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM plan_assignments pa
      WHERE pa.id = plan_hour_logs.plan_assignment_id
        AND pa.organization_id = (
          SELECT organization_id
          FROM public.users
          WHERE id = auth.uid()
        )
    )
  );
DROP POLICY IF EXISTS "Users can view their overage acceptances" ON overage_acceptances;
CREATE POLICY "Users can view their overage acceptances" ON overage_acceptances FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM plan_assignments pa
      WHERE pa.id = overage_acceptances.plan_assignment_id
        AND pa.organization_id = (
          SELECT organization_id
          FROM public.users
          WHERE id = auth.uid()
        )
    )
  );
-- =============================================================================
-- 11. DROP LEGACY TABLE (no policies or FKs reference it now)
-- =============================================================================
DROP TABLE public.profiles_legacy;