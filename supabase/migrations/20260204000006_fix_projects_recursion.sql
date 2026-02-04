-- Fix infinite recursion in project_organizations policies

-- 1. Helper function to safely get project owner without triggering RLS recursion
CREATE OR REPLACE FUNCTION get_project_owner_org_id(p_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id FROM projects WHERE id = p_id;
$$;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Users can view project organizations for accessible projects" ON public.project_organizations;
DROP POLICY IF EXISTS "Partners can manage project organizations for their projects" ON public.project_organizations;

-- 3. Create specific, non-recursive policies

-- A. Users can view assignments to their own organization (Clients/Partners/Vendors)
CREATE POLICY "Users can view assignments to their org"
ON public.project_organizations FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
);

-- B. Partners can manage assignments for projects they own
CREATE POLICY "Partners can manage assignments for their projects"
ON public.project_organizations FOR ALL
TO authenticated
USING (
    -- Check if user is partner and their org owns the project (using safe function)
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('partner', 'partner_staff')
        AND organization_id = get_project_owner_org_id(project_organizations.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('partner', 'partner_staff')
        AND organization_id = get_project_owner_org_id(project_organizations.project_id)
    )
);
