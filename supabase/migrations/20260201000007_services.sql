-- Services and Service Requests Tables
-- Enables admin-managed service catalog and client service request workflow

-- ============================================================================
-- SERVICES TABLE
-- Admin-created catalog of services offered to clients
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Service details
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., 'custom_code', 'custom_software', 'custom_plugin', 'maintenance', 'support'

  -- Pricing
  base_rate NUMERIC(10,2), -- Base price in cents
  rate_type TEXT CHECK (rate_type IN ('hourly', 'fixed', 'tiered', 'custom')),
  estimated_hours NUMERIC(5,2), -- Estimated hours for fixed-price services

  -- Configuration
  requires_approval BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- SERVICE REQUESTS TABLE
-- Client requests for services (separate entity requiring approval)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Request details
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Status workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted', 'cancelled')),

  -- Additional details from client
  details JSONB, -- Custom fields, notes, requirements
  requested_start_date DATE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Approval workflow
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  internal_notes TEXT, -- Staff-only notes

  -- Conversion tracking (when approved)
  converted_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  converted_invoice_id UUID, -- Will reference invoices table (created later)

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Services indexes
DROP INDEX IF EXISTS idx_services_org;
DROP INDEX IF EXISTS idx_services_active;
DROP INDEX IF EXISTS idx_services_category;

CREATE INDEX IF NOT EXISTS idx_services_org ON public.services(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);

-- Service requests indexes
DROP INDEX IF EXISTS idx_service_requests_org;
DROP INDEX IF EXISTS idx_service_requests_service;
DROP INDEX IF EXISTS idx_service_requests_requester;
DROP INDEX IF EXISTS idx_service_requests_status;
DROP INDEX IF EXISTS idx_service_requests_pending;

CREATE INDEX IF NOT EXISTS idx_service_requests_org ON public.service_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_service ON public.service_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_requester ON public.service_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_pending ON public.service_requests(status) WHERE status = 'pending';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.services IS 'Admin-managed catalog of services offered to clients';
COMMENT ON TABLE public.service_requests IS 'Client requests for services requiring admin approval';

COMMENT ON COLUMN public.services.rate_type IS 'hourly: charged per hour, fixed: one-time price, tiered: volume-based, custom: contact for quote';
COMMENT ON COLUMN public.service_requests.status IS 'pending: awaiting review, approved: approved by admin, rejected: declined, converted: became ticket/invoice, cancelled: cancelled by client';
COMMENT ON COLUMN public.service_requests.details IS 'JSON object with custom fields, client notes, and additional requirements';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICES RLS POLICIES
-- ============================================================================

-- Clients can view active services in their org
DROP POLICY IF EXISTS "Users can view active org services" ON public.services;
CREATE POLICY "Users can view active org services"
  ON public.services
  FOR SELECT
  USING (
    is_active = true AND
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Staff can view all services (including inactive)
DROP POLICY IF EXISTS "Staff can view all org services" ON public.services;
CREATE POLICY "Staff can view all org services"
  ON public.services
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff', 'partner')
    )
  );

-- Only admins and staff can create/edit services
DROP POLICY IF EXISTS "Staff can manage services" ON public.services;
CREATE POLICY "Staff can manage services"
  ON public.services
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
    )
  );

-- ============================================================================
-- SERVICE REQUESTS RLS POLICIES
-- ============================================================================

-- Users can view their own service requests
DROP POLICY IF EXISTS "Users can view own service requests" ON public.service_requests;
CREATE POLICY "Users can view own service requests"
  ON public.service_requests
  FOR SELECT
  USING (
    requested_by = auth.uid() OR
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff', 'partner')
    )
  );

-- Users can create service requests in their org
DROP POLICY IF EXISTS "Users can create service requests" ON public.service_requests;
CREATE POLICY "Users can create service requests"
  ON public.service_requests
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid() AND
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Users can cancel their own pending requests
DROP POLICY IF EXISTS "Users can cancel own requests" ON public.service_requests;
CREATE POLICY "Users can cancel own requests"
  ON public.service_requests
  FOR UPDATE
  USING (
    requested_by = auth.uid() AND
    status = 'pending'
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- Staff can update any service request in their org
DROP POLICY IF EXISTS "Staff can update org service requests" ON public.service_requests;
CREATE POLICY "Staff can update org service requests"
  ON public.service_requests
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff', 'partner')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff', 'partner')
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp for services
DROP TRIGGER IF EXISTS set_services_updated_at ON public.services;
CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auto-update updated_at timestamp for service requests
DROP TRIGGER IF EXISTS set_service_requests_updated_at ON public.service_requests;
CREATE TRIGGER set_service_requests_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.services TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;

GRANT SELECT ON public.service_requests TO authenticated;
GRANT INSERT, UPDATE ON public.service_requests TO authenticated;
