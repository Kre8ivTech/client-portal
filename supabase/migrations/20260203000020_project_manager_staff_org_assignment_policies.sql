-- Allow project managers (staff) to manage staff_organization_assignments for their org(s)
-- Date: 2026-02-03

ALTER TABLE public.staff_organization_assignments ENABLE ROW LEVEL SECURITY;

-- Project managers can view assignments within their managed org(s)
CREATE POLICY "Project managers can view staff org assignments for their org"
  ON public.staff_organization_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_organization_assignments pm
      WHERE pm.staff_user_id = auth.uid()
        AND pm.organization_id = staff_organization_assignments.organization_id
        AND pm.assignment_role = 'project_manager'
        AND pm.is_active = TRUE
    )
  );

-- Project managers can create assignments within their managed org(s)
CREATE POLICY "Project managers can create staff org assignments for their org"
  ON public.staff_organization_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff_organization_assignments pm
      WHERE pm.staff_user_id = auth.uid()
        AND pm.organization_id = staff_organization_assignments.organization_id
        AND pm.assignment_role = 'project_manager'
        AND pm.is_active = TRUE
    )
  );

-- Project managers can update assignments within their managed org(s)
CREATE POLICY "Project managers can update staff org assignments for their org"
  ON public.staff_organization_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_organization_assignments pm
      WHERE pm.staff_user_id = auth.uid()
        AND pm.organization_id = staff_organization_assignments.organization_id
        AND pm.assignment_role = 'project_manager'
        AND pm.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff_organization_assignments pm
      WHERE pm.staff_user_id = auth.uid()
        AND pm.organization_id = staff_organization_assignments.organization_id
        AND pm.assignment_role = 'project_manager'
        AND pm.is_active = TRUE
    )
  );

-- Project managers can delete assignments within their managed org(s)
CREATE POLICY "Project managers can delete staff org assignments for their org"
  ON public.staff_organization_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_organization_assignments pm
      WHERE pm.staff_user_id = auth.uid()
        AND pm.organization_id = staff_organization_assignments.organization_id
        AND pm.assignment_role = 'project_manager'
        AND pm.is_active = TRUE
    )
  );

