-- Migration: Projects System
-- Description: Core tables for project management with team and organization assignments
-- Date: 2026-02-03

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Identifiers
    project_number SERIAL, -- Global sequence for simplified numbering
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Classification
    status VARCHAR(30) NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),

    -- Dates
    start_date DATE,
    target_end_date DATE,
    actual_end_date DATE,

    -- Budget
    budget_amount INTEGER, -- in cents
    budget_currency VARCHAR(3) DEFAULT 'USD',

    -- Additional info
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- Audit
    created_by UUID NOT NULL REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_organization ON public.projects(organization_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_priority ON public.projects(priority);
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_start_date ON public.projects(start_date);

-- Comments
COMMENT ON TABLE public.projects IS 'Main projects table for organizing work and service requests';
COMMENT ON COLUMN public.projects.budget_amount IS 'Budget in cents for precision';

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PROJECT MEMBERS (Team Assignments)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Role on the project
    role VARCHAR(30) NOT NULL DEFAULT 'team_member'
        CHECK (role IN ('project_manager', 'account_manager', 'team_member', 'observer')),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Dates
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,

    -- Audit
    assigned_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate assignments
    UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_members_role ON public.project_members(role);
CREATE INDEX idx_project_members_active ON public.project_members(project_id) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE public.project_members IS 'Team member assignments to projects with role-based access';
COMMENT ON COLUMN public.project_members.role IS 'project_manager: full control, account_manager: client relationship, team_member: contributor, observer: read-only';

-- Trigger for updated_at
CREATE TRIGGER update_project_members_updated_at
    BEFORE UPDATE ON public.project_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PROJECT ORGANIZATIONS (Client Assignments)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Role of the organization in the project
    role VARCHAR(30) NOT NULL DEFAULT 'client'
        CHECK (role IN ('client', 'partner', 'vendor', 'collaborator')),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    assigned_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate assignments
    UNIQUE(project_id, organization_id)
);

-- Indexes
CREATE INDEX idx_project_organizations_project ON public.project_organizations(project_id);
CREATE INDEX idx_project_organizations_org ON public.project_organizations(organization_id);
CREATE INDEX idx_project_organizations_active ON public.project_organizations(project_id) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE public.project_organizations IS 'Organizations (clients, partners) associated with projects';

-- Trigger for updated_at
CREATE TRIGGER update_project_organizations_updated_at
    BEFORE UPDATE ON public.project_organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_organizations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- PROJECTS POLICIES
-- -----------------------------------------------------------------------------

-- Super admins and staff can manage all projects
CREATE POLICY "Staff can manage all projects"
ON public.projects FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- Partners can view/manage projects for their organization and client orgs
CREATE POLICY "Partners can manage their and client projects"
ON public.projects FOR ALL
TO authenticated
USING (
    -- Check if user is partner or partner_staff
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('partner', 'partner_staff')
    )
    AND (
        -- Project belongs to partner's org
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
        OR
        -- Project has partner's client org assigned
        EXISTS (
            SELECT 1 FROM public.project_organizations po
            JOIN public.organizations o ON o.id = po.organization_id
            WHERE po.project_id = projects.id
            AND o.parent_org_id IN (
                SELECT organization_id FROM public.users WHERE id = auth.uid()
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('partner', 'partner_staff')
    )
    AND organization_id IN (
        SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
);

-- Clients can view projects where their organization is assigned
CREATE POLICY "Clients can view their assigned projects"
ON public.projects FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.project_organizations po
        WHERE po.project_id = projects.id
        AND po.organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
        AND po.is_active = TRUE
    )
);

-- -----------------------------------------------------------------------------
-- PROJECT MEMBERS POLICIES
-- -----------------------------------------------------------------------------

-- Staff can manage all project members
CREATE POLICY "Staff can manage all project members"
ON public.project_members FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- Partners can manage project members for their projects
CREATE POLICY "Partners can manage project members for their projects"
ON public.project_members FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_members.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_members.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
);

-- Users can view project members for projects they have access to
CREATE POLICY "Users can view project members for accessible projects"
ON public.project_members FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id
    )
);

-- -----------------------------------------------------------------------------
-- PROJECT ORGANIZATIONS POLICIES
-- -----------------------------------------------------------------------------

-- Staff can manage all project organizations
CREATE POLICY "Staff can manage all project organizations"
ON public.project_organizations FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- Partners can manage project organizations for their projects
CREATE POLICY "Partners can manage project organizations for their projects"
ON public.project_organizations FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_organizations.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_organizations.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
);

-- Users can view project organizations for projects they have access to
CREATE POLICY "Users can view project organizations for accessible projects"
ON public.project_organizations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_organizations.project_id
    )
);

-- =============================================================================
-- ADD PROJECT TO STAFF ASSIGNMENTS
-- =============================================================================

-- Update the staff_assignments check constraint to include 'project'
ALTER TABLE public.staff_assignments
DROP CONSTRAINT IF EXISTS staff_assignments_assignable_type_check;

ALTER TABLE public.staff_assignments
ADD CONSTRAINT staff_assignments_assignable_type_check
CHECK (assignable_type IN ('ticket', 'conversation', 'service_request', 'contract', 'invoice', 'project'));

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_organizations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.projects_project_number_seq TO authenticated;
