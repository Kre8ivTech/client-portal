-- Staff Organization Access Migration
-- Allows admins to assign staff members (project managers/account managers) to organizations
-- Staff members with 'staff' role have global access to all organizations
-- Date: 2026-02-02

-- =============================================================================
-- 1. STAFF ORGANIZATION ASSIGNMENTS TABLE (Optional - for tracking assignments)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.staff_organization_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Staff member being assigned
  staff_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Organization being assigned to
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Assignment role/title (e.g., 'project_manager', 'account_manager', 'technical_lead')
  assignment_role VARCHAR(100),
  
  -- Who made the assignment
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Active status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate active assignments
  UNIQUE(staff_user_id, organization_id, is_active)
);

-- Indexes for performance
CREATE INDEX idx_staff_org_assignments_staff ON public.staff_organization_assignments(staff_user_id);
CREATE INDEX idx_staff_org_assignments_org ON public.staff_organization_assignments(organization_id);
CREATE INDEX idx_staff_org_assignments_active ON public.staff_organization_assignments(staff_user_id, is_active) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE public.staff_organization_assignments IS 'Tracks which staff members are assigned to which organizations for project management and account management';
COMMENT ON COLUMN public.staff_organization_assignments.assignment_role IS 'Role of staff at organization: project_manager, account_manager, technical_lead, etc.';

-- Trigger for updated_at
CREATE TRIGGER update_staff_org_assignments_updated_at
  BEFORE UPDATE ON public.staff_organization_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. RLS POLICIES FOR STAFF ORGANIZATION ASSIGNMENTS
-- =============================================================================

ALTER TABLE public.staff_organization_assignments ENABLE ROW LEVEL SECURITY;

-- Super admins can see all assignments
CREATE POLICY "Super admins can view all staff org assignments"
  ON public.staff_organization_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Staff can see their own assignments
CREATE POLICY "Staff can view own org assignments"
  ON public.staff_organization_assignments
  FOR SELECT
  USING (
    staff_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can create assignments
CREATE POLICY "Super admins can create staff org assignments"
  ON public.staff_organization_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can update assignments
CREATE POLICY "Super admins can update staff org assignments"
  ON public.staff_organization_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can delete assignments
CREATE POLICY "Super admins can delete staff org assignments"
  ON public.staff_organization_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================================================
-- 3. UPDATE RLS POLICIES TO ALLOW STAFF GLOBAL ACCESS
-- =============================================================================

-- Drop and recreate organization view policy for staff
DROP POLICY IF EXISTS "Users can view org" ON public.organizations;

CREATE POLICY "Users can view organizations"
  ON public.organizations
  FOR SELECT
  USING (
    -- Super admins can see all
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
    OR
    -- Staff can see all organizations
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'staff'
    )
    OR
    -- Users can see their own organization
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR
    -- Partners can see their child organizations
    parent_org_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Drop and recreate tickets view policy to allow staff to see all tickets
DROP POLICY IF EXISTS "Users can view org tickets" ON public.tickets;

CREATE POLICY "Users can view tickets"
  ON public.tickets
  FOR SELECT
  USING (
    -- Super admins and staff can see all tickets
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
    )
    OR
    -- Users can see tickets in their organization
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR
    -- Partners can see tickets in their child organizations
    organization_id IN (
      SELECT id FROM public.organizations
      WHERE parent_org_id IN (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
    )
  );

-- Update invoice view policy
DROP POLICY IF EXISTS "Users can view org invoices" ON public.invoices;

CREATE POLICY "Users can view invoices"
  ON public.invoices
  FOR SELECT
  USING (
    -- Super admins and staff can see all invoices
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
    )
    OR
    -- Users can see invoices for their organization
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR
    -- Partners can see invoices for their child organizations
    client_org_id IN (
      SELECT id FROM public.organizations
      WHERE parent_org_id IN (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
    )
  );

-- Update contracts view policy
DROP POLICY IF EXISTS "Users can view org contracts" ON public.contracts;

CREATE POLICY "Users can view contracts"
  ON public.contracts
  FOR SELECT
  USING (
    -- Super admins and staff can see all contracts
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
    )
    OR
    -- Users can see contracts for their organization
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR
    -- Partners can see contracts for their child organizations
    client_org_id IN (
      SELECT id FROM public.organizations
      WHERE parent_org_id IN (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
    )
  );

-- Update service requests view policy
DROP POLICY IF EXISTS "Users can view org service requests" ON public.service_requests;

CREATE POLICY "Users can view service requests"
  ON public.service_requests
  FOR SELECT
  USING (
    -- Super admins and staff can see all service requests
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
    )
    OR
    -- Users can see service requests for their organization
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
    OR
    -- Partners can see service requests for their child organizations
    client_org_id IN (
      SELECT id FROM public.organizations
      WHERE parent_org_id IN (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
    )
  );

-- Update conversations view policy
DROP POLICY IF EXISTS "Users can view org conversations" ON public.conversations;

CREATE POLICY "Users can view conversations"
  ON public.conversations
  FOR SELECT
  USING (
    -- Super admins and staff can see all conversations
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff')
    )
    OR
    -- Users can see conversations they're part of
    auth.uid() = ANY(
      SELECT jsonb_array_elements_text(participant_ids)::uuid
      FROM public.conversations c
      WHERE c.id = conversations.id
    )
    OR
    -- Users can see conversations in their organization
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- =============================================================================
-- 4. HELPER FUNCTION TO CHECK IF STAFF HAS ACCESS TO ORGANIZATION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.staff_has_org_access(
  p_staff_user_id UUID,
  p_organization_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is super_admin or staff (they have global access)
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_staff_user_id
    AND role IN ('super_admin', 'staff')
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if staff has specific assignment (optional, for tracking purposes)
  IF EXISTS (
    SELECT 1 FROM public.staff_organization_assignments
    WHERE staff_user_id = p_staff_user_id
    AND organization_id = p_organization_id
    AND is_active = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.staff_has_org_access IS 'Check if a staff member has access to an organization';

-- =============================================================================
-- 5. VIEW FOR STAFF WITH ORGANIZATION ASSIGNMENTS
-- =============================================================================

CREATE OR REPLACE VIEW public.staff_with_org_assignments AS
SELECT 
  u.id AS staff_id,
  u.email,
  p.name AS staff_name,
  u.role,
  u.status,
  u.organization_id AS home_organization_id,
  ho.name AS home_organization_name,
  COALESCE(
    json_agg(
      json_build_object(
        'assignment_id', soa.id,
        'organization_id', soa.organization_id,
        'organization_name', o.name,
        'assignment_role', soa.assignment_role,
        'assigned_at', soa.assigned_at,
        'is_active', soa.is_active
      )
    ) FILTER (WHERE soa.id IS NOT NULL),
    '[]'
  ) AS organization_assignments
FROM public.users u
JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.organizations ho ON ho.id = u.organization_id
LEFT JOIN public.staff_organization_assignments soa ON soa.staff_user_id = u.id AND soa.is_active = TRUE
LEFT JOIN public.organizations o ON o.id = soa.organization_id
WHERE u.role IN ('super_admin', 'staff')
GROUP BY u.id, u.email, p.name, u.role, u.status, u.organization_id, ho.name;

COMMENT ON VIEW public.staff_with_org_assignments IS 'View of all staff members with their organization assignments';

-- Grant access to authenticated users
GRANT SELECT ON public.staff_with_org_assignments TO authenticated;
