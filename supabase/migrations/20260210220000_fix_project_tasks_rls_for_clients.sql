-- Migration: Fix project_tasks RLS policies for client access
-- Description: Updates RLS policies to properly respect project access permissions
-- Date: 2026-02-10
-- Issue: Project tasks not loading for client accounts

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Project members can manage tasks" ON public.project_tasks;

-- =============================================================================
-- STAFF POLICIES (unchanged)
-- =============================================================================
-- Staff policy already exists and is correct

-- =============================================================================
-- NEW POLICIES FOR PROJECT ACCESS
-- =============================================================================

-- Partners can manage tasks in their projects and client projects
CREATE POLICY "Partners can manage tasks in their projects"
ON public.project_tasks FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.projects p ON p.id = project_tasks.project_id
        WHERE u.id = auth.uid()
        AND u.role IN ('partner', 'partner_staff')
        AND (
            -- Project belongs to partner's org
            p.organization_id = u.organization_id
            OR
            -- Project has partner's client org assigned
            EXISTS (
                SELECT 1 FROM public.project_organizations po
                JOIN public.organizations o ON o.id = po.organization_id
                WHERE po.project_id = p.id
                AND o.parent_org_id = u.organization_id
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.projects p ON p.id = project_tasks.project_id
        WHERE u.id = auth.uid()
        AND u.role IN ('partner', 'partner_staff')
        AND (
            -- Project belongs to partner's org
            p.organization_id = u.organization_id
            OR
            -- Project has partner's client org assigned
            EXISTS (
                SELECT 1 FROM public.project_organizations po
                JOIN public.organizations o ON o.id = po.organization_id
                WHERE po.project_id = p.id
                AND o.parent_org_id = u.organization_id
            )
        )
    )
);

-- Clients can view and manage tasks in their assigned projects
CREATE POLICY "Clients can manage tasks in their projects"
ON public.project_tasks FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.project_organizations po ON po.organization_id = u.organization_id
        WHERE u.id = auth.uid()
        AND u.role = 'client'
        AND po.project_id = project_tasks.project_id
        AND po.is_active = TRUE
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.project_organizations po ON po.organization_id = u.organization_id
        WHERE u.id = auth.uid()
        AND u.role = 'client'
        AND po.project_id = project_tasks.project_id
        AND po.is_active = TRUE
    )
);

-- Project team members can manage tasks in their assigned projects
CREATE POLICY "Project team members can manage tasks"
ON public.project_tasks FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_tasks.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = TRUE
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_tasks.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = TRUE
    )
);
