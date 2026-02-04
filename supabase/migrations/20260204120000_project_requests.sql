-- Migration: Project Requests System
-- Description: Allow clients to request new projects that staff can approve/reject
-- Date: 2026-02-04

-- ============================================================================
-- PROJECT REQUESTS TABLE
-- Client requests for new projects (requires approval workflow)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Request details
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT, -- e.g., 'website', 'mobile_app', 'custom_software', 'maintenance', 'consulting'
  
  -- Timeline preferences
  requested_start_date DATE,
  requested_end_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Budget information (optional)
  estimated_budget_min NUMERIC(12,2),
  estimated_budget_max NUMERIC(12,2),
  budget_flexibility TEXT CHECK (budget_flexibility IN ('fixed', 'flexible', 'negotiable')),
  
  -- Additional details
  requirements TEXT, -- Detailed requirements from client
  attachments JSONB DEFAULT '[]'::jsonb, -- File URLs
  
  -- Status workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'converted', 'cancelled')),
  
  -- Review workflow
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT, -- Internal notes from reviewer
  rejection_reason TEXT,
  
  -- Conversion tracking (when approved and converted to actual project)
  converted_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_requests_org ON public.project_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_requests_requester ON public.project_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_project_requests_status ON public.project_requests(status);
CREATE INDEX IF NOT EXISTS idx_project_requests_pending ON public.project_requests(status) WHERE status = 'pending';

-- ============================================================================
-- AUTO-INCREMENT REQUEST NUMBER
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_project_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'PR-' || LPAD(
    (SELECT COALESCE(MAX(SUBSTRING(request_number FROM 4)::INTEGER), 0) + 1 
     FROM public.project_requests)::TEXT, 
    5, '0'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_project_request_number ON public.project_requests;
CREATE TRIGGER set_project_request_number
  BEFORE INSERT ON public.project_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL)
  EXECUTE FUNCTION generate_project_request_number();

-- ============================================================================
-- AUTO-UPDATE TIMESTAMP
-- ============================================================================

DROP TRIGGER IF EXISTS set_project_requests_updated_at ON public.project_requests;
CREATE TRIGGER set_project_requests_updated_at
  BEFORE UPDATE ON public.project_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.project_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own project requests
DROP POLICY IF EXISTS "Users can view own project requests" ON public.project_requests;
CREATE POLICY "Users can view own project requests"
  ON public.project_requests
  FOR SELECT
  USING (
    requested_by = auth.uid()
    OR
    -- Staff/Admin can view all requests in their org
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff', 'partner')
    )
  );

-- Super admin can view all project requests
DROP POLICY IF EXISTS "Super admin can view all project requests" ON public.project_requests;
CREATE POLICY "Super admin can view all project requests"
  ON public.project_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Users can create project requests in their org
DROP POLICY IF EXISTS "Users can create project requests" ON public.project_requests;
CREATE POLICY "Users can create project requests"
  ON public.project_requests
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Users can cancel their own pending requests
DROP POLICY IF EXISTS "Users can cancel own project requests" ON public.project_requests;
CREATE POLICY "Users can cancel own project requests"
  ON public.project_requests
  FOR UPDATE
  USING (
    requested_by = auth.uid()
    AND status IN ('pending', 'under_review')
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- Staff can update project requests in their org
DROP POLICY IF EXISTS "Staff can update org project requests" ON public.project_requests;
CREATE POLICY "Staff can update org project requests"
  ON public.project_requests
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

-- Super admin can update any project request
DROP POLICY IF EXISTS "Super admin can update any project request" ON public.project_requests;
CREATE POLICY "Super admin can update any project request"
  ON public.project_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.project_requests TO authenticated;
GRANT INSERT, UPDATE ON public.project_requests TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.project_requests IS 'Client requests for new projects requiring admin approval';
COMMENT ON COLUMN public.project_requests.status IS 'pending: awaiting review, under_review: being evaluated, approved: approved by admin, rejected: declined, converted: became actual project, cancelled: cancelled by client';
COMMENT ON COLUMN public.project_requests.project_type IS 'Type of project: website, mobile_app, custom_software, maintenance, consulting, etc.';
