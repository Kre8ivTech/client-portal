-- Migration: Invoice client_id, encrypted QuickBooks tokens, customer mapping
-- Date: 2026-09-08
-- Description:
--   1. Add invoices.client_id so billed clients can be selected and notified.
--   2. Encrypt QuickBooks OAuth tokens at rest and store company name.
--   3. Map portal clients to QuickBooks customers per connected organization.
--   4. Fix QuickBooks RLS to use public.users (profiles no longer has role).
--   5. Let billed clients view invoices addressed to them.
--   6. Let partner admins create invoices for their own org.

-- =============================================================================
-- 1. invoices.client_id
-- =============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);

COMMENT ON COLUMN public.invoices.client_id IS
  'Portal user this invoice is billed to. Distinct from organization_id, which is the issuer (books owner).';

-- Backfill from metadata.client_id when present and valid
UPDATE public.invoices i
SET client_id = (i.metadata->>'client_id')::uuid
WHERE i.client_id IS NULL
  AND i.metadata ? 'client_id'
  AND (i.metadata->>'client_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = (i.metadata->>'client_id')::uuid
  );

-- =============================================================================
-- 2. Client visibility of invoices billed to them
-- =============================================================================

DROP POLICY IF EXISTS "Clients can view invoices billed to them" ON public.invoices;
CREATE POLICY "Clients can view invoices billed to them"
  ON public.invoices FOR SELECT
  USING (client_id = auth.uid() AND can_view_invoices());

DROP POLICY IF EXISTS "Clients can view line items for invoices billed to them" ON public.invoice_line_items;
CREATE POLICY "Clients can view line items for invoices billed to them"
  ON public.invoice_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
        AND i.client_id = auth.uid()
        AND can_view_invoices()
    )
  );

-- =============================================================================
-- 3. Partners can create/update invoices in their own organization
-- =============================================================================

DROP POLICY IF EXISTS "Partners can create org invoices" ON public.invoices;
CREATE POLICY "Partners can create org invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'partner'
    )
  );

DROP POLICY IF EXISTS "Partners can update org invoices" ON public.invoices;
CREATE POLICY "Partners can update org invoices"
  ON public.invoices FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'partner'
    )
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'partner'
    )
  );

-- =============================================================================
-- 4. Encrypted QuickBooks tokens
-- =============================================================================

ALTER TABLE public.quickbooks_integrations
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS access_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS access_token_auth_tag TEXT,
  ADD COLUMN IF NOT EXISTS access_token_salt TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_auth_tag TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_salt TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;

ALTER TABLE public.quickbooks_integrations
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN refresh_token DROP NOT NULL;

COMMENT ON COLUMN public.quickbooks_integrations.access_token_encrypted IS
  'AES-256-GCM ciphertext for the QuickBooks access token. Prefer this over access_token.';
COMMENT ON COLUMN public.quickbooks_integrations.refresh_token_encrypted IS
  'AES-256-GCM ciphertext for the QuickBooks refresh token. Prefer this over refresh_token.';
COMMENT ON COLUMN public.quickbooks_integrations.company_name IS
  'QuickBooks company name from CompanyInfo at connect time.';

-- =============================================================================
-- 5. Fix QuickBooks integration RLS (profiles no longer has role)
-- =============================================================================

DROP POLICY IF EXISTS "Account managers can view QB integrations" ON public.quickbooks_integrations;
DROP POLICY IF EXISTS "Account managers can manage QB integrations" ON public.quickbooks_integrations;

CREATE POLICY "Account managers can view QB integrations"
  ON public.quickbooks_integrations FOR SELECT
  USING (
    is_super_admin()
    OR (
      organization_id = get_user_organization_id()
      AND (
        is_account_manager()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'partner')
      )
    )
  );

CREATE POLICY "Account managers can manage QB integrations"
  ON public.quickbooks_integrations FOR ALL
  USING (
    is_super_admin()
    OR (
      organization_id = get_user_organization_id()
      AND (
        is_account_manager()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'partner')
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_user_organization_id()
      AND (
        is_account_manager()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'partner')
      )
    )
  );

-- =============================================================================
-- 6. QuickBooks customer mapping
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.quickbooks_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  portal_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  portal_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  qb_customer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, qb_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_customers_org ON public.quickbooks_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_qb_customers_portal_user ON public.quickbooks_customers(portal_user_id);

COMMENT ON TABLE public.quickbooks_customers IS
  'Maps QuickBooks customers to portal users/organizations for the connected issuer org.';

ALTER TABLE public.quickbooks_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account managers can view QB customers" ON public.quickbooks_customers;
CREATE POLICY "Account managers can view QB customers"
  ON public.quickbooks_customers FOR SELECT
  USING (
    is_super_admin()
    OR (
      organization_id = get_user_organization_id()
      AND (
        is_account_manager()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'partner')
      )
    )
  );

DROP POLICY IF EXISTS "Account managers can manage QB customers" ON public.quickbooks_customers;
CREATE POLICY "Account managers can manage QB customers"
  ON public.quickbooks_customers FOR ALL
  USING (
    is_super_admin()
    OR (
      organization_id = get_user_organization_id()
      AND (
        is_account_manager()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'partner')
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_user_organization_id()
      AND (
        is_account_manager()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'partner')
      )
    )
  );
