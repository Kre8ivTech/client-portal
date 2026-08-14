-- Google Ads reporting for white-label partner organizations.
-- OAuth credentials are encrypted by the application before storage and are
-- intentionally inaccessible to authenticated browser clients.

CREATE TABLE public.google_ads_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  connected_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  google_email TEXT,
  refresh_token_encrypted TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  refresh_token_auth_tag TEXT NOT NULL,
  refresh_token_salt TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  available_customers JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_id TEXT,
  login_customer_id TEXT,
  customer_name TEXT,
  currency_code TEXT,
  time_zone TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'error', 'revoked')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (customer_id IS NULL OR customer_id ~ '^[0-9]{10}$'),
  CHECK (login_customer_id IS NULL OR login_customer_id ~ '^[0-9]{10}$')
);

CREATE INDEX google_ads_connections_status_idx
  ON public.google_ads_connections(status)
  WHERE customer_id IS NOT NULL;

CREATE TRIGGER update_google_ads_connections_updated_at
  BEFORE UPDATE ON public.google_ads_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.google_ads_connections ENABLE ROW LEVEL SECURITY;

-- Connections contain encrypted credentials. All access goes through
-- authenticated server routes after an explicit organization/role check.
REVOKE ALL ON public.google_ads_connections FROM anon, authenticated;

CREATE TABLE public.google_ads_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.google_ads_connections(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL CHECK (customer_id ~ '^[0-9]{10}$'),
  metric_date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  cost_micros BIGINT NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  conversions NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  conversion_value NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (conversion_value >= 0),
  campaigns JSONB NOT NULL DEFAULT '[]'::jsonb,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, customer_id, metric_date)
);

CREATE INDEX google_ads_daily_metrics_org_date_idx
  ON public.google_ads_daily_metrics(organization_id, metric_date DESC);

ALTER TABLE public.google_ads_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own Google Ads metrics"
  ON public.google_ads_daily_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.organization_id = google_ads_daily_metrics.organization_id
        AND users.role IN ('partner', 'partner_staff')
    )
  );

GRANT SELECT ON public.google_ads_daily_metrics TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.google_ads_daily_metrics FROM anon, authenticated;

COMMENT ON TABLE public.google_ads_connections IS
  'Server-only encrypted Google Ads OAuth connections, one per partner organization.';
COMMENT ON TABLE public.google_ads_daily_metrics IS
  'Tenant-isolated daily Google Ads performance, campaign snapshots, and account issues.';
