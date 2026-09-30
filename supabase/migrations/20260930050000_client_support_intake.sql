-- Website and email intake, ticket ratings, plan overage billing,
-- public status incidents, and client handoffs.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS satisfaction_rating SMALLINT,
  ADD COLUMN IF NOT EXISTS satisfaction_comment TEXT;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_satisfaction_rating_range;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_satisfaction_rating_range
  CHECK (satisfaction_rating IS NULL OR satisfaction_rating BETWEEN 1 AND 5);

ALTER TABLE public.site_monitors
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_window TEXT,
  ADD COLUMN IF NOT EXISTS care_notes TEXT;

CREATE TABLE IF NOT EXISTS public.inbound_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('website', 'email')),
  external_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  subject TEXT NOT NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_requests_email_created
  ON public.inbound_requests (email, created_at DESC);

ALTER TABLE public.inbound_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read inbound requests" ON public.inbound_requests;
CREATE POLICY "Staff read inbound requests"
  ON public.inbound_requests FOR SELECT
  USING (public.is_admin_or_staff());

CREATE TABLE IF NOT EXISTS public.plan_overage_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_assignment_id UUID NOT NULL REFERENCES public.plan_assignments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL CHECK (work_type IN ('support', 'dev')),
  period_key TEXT NOT NULL,
  hours_billed NUMERIC(10, 2) NOT NULL DEFAULT 0,
  last_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_assignment_id, work_type, period_key)
);

ALTER TABLE public.plan_overage_ledgers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read overage ledgers" ON public.plan_overage_ledgers;
CREATE POLICY "Staff read overage ledgers"
  ON public.plan_overage_ledgers FOR SELECT
  USING (public.is_admin_or_staff());

CREATE TABLE IF NOT EXISTS public.status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('maintenance', 'degraded', 'outage')),
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage status incidents" ON public.status_incidents;
CREATE POLICY "Staff manage status incidents"
  ON public.status_incidents FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

CREATE TABLE IF NOT EXISTS public.client_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  live_url TEXT,
  owner_name TEXT,
  update_notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_handoffs_org ON public.client_handoffs (organization_id);

ALTER TABLE public.client_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients read own handoffs" ON public.client_handoffs;
CREATE POLICY "Clients read own handoffs"
  ON public.client_handoffs FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
    OR public.is_admin_or_staff()
    OR organization_id IN (
      SELECT id FROM public.organizations
      WHERE parent_org_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff manage handoffs" ON public.client_handoffs;
CREATE POLICY "Staff manage handoffs"
  ON public.client_handoffs FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());
