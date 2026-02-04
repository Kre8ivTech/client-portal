-- Staff Assignments Table
-- Manages assignment of staff members to various resources (tickets, conversations, service requests)
-- Supports multi-tenant isolation and flexible role-based assignments

CREATE TABLE IF NOT EXISTS public.staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Polymorphic reference to assignable resources
  assignable_type TEXT NOT NULL CHECK (assignable_type IN ('ticket', 'conversation', 'service_request', 'contract', 'invoice')),
  assignable_id UUID NOT NULL,

  -- Staff member assignment
  staff_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Assignment metadata
  role TEXT CHECK (role IN ('primary', 'backup', 'observer', 'reviewer')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate assignments
  UNIQUE(assignable_type, assignable_id, staff_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_assignments_org ON public.staff_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_assignable ON public.staff_assignments(assignable_type, assignable_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff_user ON public.staff_assignments(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_active ON public.staff_assignments(assignable_type, assignable_id) WHERE unassigned_at IS NULL;

-- Comments for documentation
COMMENT ON TABLE public.staff_assignments IS 'Tracks staff member assignments to various resources across the application';
COMMENT ON COLUMN public.staff_assignments.assignable_type IS 'Type of resource: ticket, conversation, service_request, contract, or invoice';
COMMENT ON COLUMN public.staff_assignments.assignable_id IS 'UUID of the assigned resource';
COMMENT ON COLUMN public.staff_assignments.role IS 'Assignment role: primary (main assignee), backup, observer, or reviewer';

-- Enable Row Level Security
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view assignments in their organization
CREATE POLICY "Users can view org staff assignments"
  ON public.staff_assignments
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- RLS Policy: Staff and admins can create assignments
CREATE POLICY "Staff can create assignments"
  ON public.staff_assignments
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff', 'partner')
    )
  );

-- RLS Policy: Staff and admins can update assignments
CREATE POLICY "Staff can update assignments"
  ON public.staff_assignments
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

-- RLS Policy: Staff and admins can delete (unassign)
CREATE POLICY "Staff can delete assignments"
  ON public.staff_assignments
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff', 'partner')
    )
  );

-- Function to automatically set updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row updates
CREATE TRIGGER set_staff_assignments_updated_at
  BEFORE UPDATE ON public.staff_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Grant permissions
GRANT SELECT ON public.staff_assignments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.staff_assignments TO authenticated;
