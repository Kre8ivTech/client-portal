-- Partner API keys, WordPress monitor heartbeats, and per-organization
-- marketing credentials. Idempotent so a restarted container can reapply it.

ALTER TABLE public.site_monitors
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wp_version TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_site_monitors_last_seen
  ON public.site_monitors (last_seen_at DESC);

COMMENT ON COLUMN public.site_monitors.last_seen_at IS
  'Last heartbeat from a connected site, such as the WordPress monitor plugin.';
COMMENT ON COLUMN public.site_monitors.wp_version IS
  'WordPress version reported by the latest heartbeat.';
COMMENT ON COLUMN public.site_monitors.metadata IS
  'Non-secret monitor details such as https and heartbeat source.';

CREATE TABLE IF NOT EXISTS public.partner_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_api_keys_hash_unique UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_partner_api_keys_org
  ON public.partner_api_keys (organization_id, created_at DESC);

ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org managers read partner api keys" ON public.partner_api_keys;
CREATE POLICY "Org managers read partner api keys"
  ON public.partner_api_keys
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() IN ('partner', 'partner_staff', 'staff', 'super_admin', 'admin')
  );

DROP POLICY IF EXISTS "Org managers insert partner api keys" ON public.partner_api_keys;
CREATE POLICY "Org managers insert partner api keys"
  ON public.partner_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (
      (
        public.get_user_role() IN ('partner', 'partner_staff')
        AND public.get_user_organization_type() = 'partner'
      )
      OR (
        public.get_user_role() IN ('staff', 'super_admin', 'admin')
        AND public.get_user_organization_type() IN ('kre8ivtech', 'partner')
      )
    )
  );

DROP POLICY IF EXISTS "Org managers revoke partner api keys" ON public.partner_api_keys;
CREATE POLICY "Org managers revoke partner api keys"
  ON public.partner_api_keys
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() IN ('partner', 'partner_staff', 'staff', 'super_admin', 'admin')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() IN ('partner', 'partner_staff', 'staff', 'super_admin', 'admin')
  );

REVOKE ALL ON public.partner_api_keys FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.partner_api_keys TO authenticated;

COMMENT ON TABLE public.partner_api_keys IS
  'Hashed partner API keys. The raw key is shown once at creation and is not stored.';

CREATE TABLE IF NOT EXISTS public.organization_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (
    provider IN ('google_ads', 'ga4', 'google_oauth', 'search_console', 'tag_manager')
  ),
  encrypted_data TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  salt TEXT NOT NULL,
  public_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_provider_credentials_org_provider_unique UNIQUE (organization_id, provider)
);

DROP TRIGGER IF EXISTS update_organization_provider_credentials_updated_at
  ON public.organization_provider_credentials;
CREATE TRIGGER update_organization_provider_credentials_updated_at
  BEFORE UPDATE ON public.organization_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.organization_provider_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.organization_provider_credentials FROM anon, authenticated;

COMMENT ON TABLE public.organization_provider_credentials IS
  'Server-only encrypted marketing credentials, one row per organization and provider.';
