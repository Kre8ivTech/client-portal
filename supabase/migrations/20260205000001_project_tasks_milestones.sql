-- Migration: Project Tasks, Milestones, and Time Entries
-- Description: Add task management, milestones, and time tracking for projects
-- Date: 2026-02-05

-- =============================================================================
-- PROJECT MILESTONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Milestone info
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Dates
    due_date DATE,
    completed_date DATE,

    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'missed')),

    -- Ordering
    sort_order INTEGER DEFAULT 0,

    -- Audit
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_project_milestones_status ON public.project_milestones(status);
CREATE INDEX idx_project_milestones_due_date ON public.project_milestones(due_date);

-- Trigger for updated_at
CREATE TRIGGER update_project_milestones_updated_at
    BEFORE UPDATE ON public.project_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.project_milestones IS 'Project milestones for timeline tracking';

-- =============================================================================
-- PROJECT TASKS (Kanban Board Items)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
    parent_task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,

    -- Task info
    task_number SERIAL, -- Global sequence for simplified numbering
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Classification
    status VARCHAR(30) NOT NULL DEFAULT 'backlog'
        CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    task_type VARCHAR(30) DEFAULT 'task'
        CHECK (task_type IN ('task', 'bug', 'feature', 'improvement', 'documentation', 'research')),

    -- Assignment
    assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Dates
    due_date DATE,
    start_date DATE,
    completed_at TIMESTAMPTZ,

    -- Time tracking
    estimated_hours NUMERIC(10, 2),
    actual_hours NUMERIC(10, 2) DEFAULT 0,

    -- Billing
    billable BOOLEAN DEFAULT TRUE,
    hourly_rate INTEGER, -- in cents, optional override

    -- Ordering
    sort_order INTEGER DEFAULT 0,
    board_column_order INTEGER DEFAULT 0, -- For Kanban board position

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
CREATE INDEX idx_project_tasks_project ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_milestone ON public.project_tasks(milestone_id);
CREATE INDEX idx_project_tasks_parent ON public.project_tasks(parent_task_id);
CREATE INDEX idx_project_tasks_status ON public.project_tasks(status);
CREATE INDEX idx_project_tasks_priority ON public.project_tasks(priority);
CREATE INDEX idx_project_tasks_assignee ON public.project_tasks(assignee_id);
CREATE INDEX idx_project_tasks_due_date ON public.project_tasks(due_date);
CREATE INDEX idx_project_tasks_type ON public.project_tasks(task_type);

-- Trigger for updated_at
CREATE TRIGGER update_project_tasks_updated_at
    BEFORE UPDATE ON public.project_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.project_tasks IS 'Tasks within projects for Kanban board and task tracking';
COMMENT ON COLUMN public.project_tasks.hourly_rate IS 'Optional rate override in cents for billing';

-- =============================================================================
-- PROJECT TASK COMMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,

    -- Comment content
    content TEXT NOT NULL,

    -- Audit
    author_id UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_task_comments_task ON public.project_task_comments(task_id);
CREATE INDEX idx_project_task_comments_author ON public.project_task_comments(author_id);

-- Trigger for updated_at
CREATE TRIGGER update_project_task_comments_updated_at
    BEFORE UPDATE ON public.project_task_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.project_task_comments IS 'Comments on project tasks';

-- =============================================================================
-- PROJECT TIME ENTRIES (Extends existing time_entries concept)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,

    -- Time entry details
    user_id UUID NOT NULL REFERENCES public.users(id),
    description TEXT,
    hours NUMERIC(10, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Billing
    billable BOOLEAN DEFAULT TRUE,
    hourly_rate INTEGER, -- in cents, from task or project default
    billed BOOLEAN DEFAULT FALSE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_time_entries_project ON public.project_time_entries(project_id);
CREATE INDEX idx_project_time_entries_task ON public.project_time_entries(task_id);
CREATE INDEX idx_project_time_entries_user ON public.project_time_entries(user_id);
CREATE INDEX idx_project_time_entries_date ON public.project_time_entries(entry_date);
CREATE INDEX idx_project_time_entries_invoice ON public.project_time_entries(invoice_id);
CREATE INDEX idx_project_time_entries_unbilled ON public.project_time_entries(project_id) WHERE billed = FALSE AND billable = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_project_time_entries_updated_at
    BEFORE UPDATE ON public.project_time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update task actual_hours when time entry is added/updated/deleted
CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.project_tasks
        SET actual_hours = COALESCE((
            SELECT SUM(hours) FROM public.project_time_entries
            WHERE task_id = OLD.task_id
        ), 0)
        WHERE id = OLD.task_id;
        RETURN OLD;
    ELSE
        UPDATE public.project_tasks
        SET actual_hours = COALESCE((
            SELECT SUM(hours) FROM public.project_time_entries
            WHERE task_id = NEW.task_id
        ), 0)
        WHERE id = NEW.task_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_hours_on_time_entry
    AFTER INSERT OR UPDATE OR DELETE ON public.project_time_entries
    FOR EACH ROW EXECUTE FUNCTION update_task_actual_hours();

COMMENT ON TABLE public.project_time_entries IS 'Time entries for project tasks, linked to invoicing';

-- =============================================================================
-- PROJECT INVOICES (Link projects to invoices)
-- =============================================================================

-- Add project_id column to invoices table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE public.invoices
        ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

        CREATE INDEX idx_invoices_project ON public.invoices(project_id);
    END IF;
END $$;

-- Add contract_id column to projects table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'contract_id'
    ) THEN
        ALTER TABLE public.projects
        ADD COLUMN contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;

        CREATE INDEX idx_projects_contract ON public.projects(contract_id);
    END IF;
END $$;

-- Add default hourly rate to projects
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'default_hourly_rate'
    ) THEN
        ALTER TABLE public.projects
        ADD COLUMN default_hourly_rate INTEGER; -- in cents

        COMMENT ON COLUMN public.projects.default_hourly_rate IS 'Default hourly rate in cents for project time entries';
    END IF;
END $$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- PROJECT MILESTONES POLICIES
-- -----------------------------------------------------------------------------

-- Staff can manage all milestones
CREATE POLICY "Staff can manage all project milestones"
ON public.project_milestones FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- Partners can manage milestones for their projects
CREATE POLICY "Partners can manage milestones for their projects"
ON public.project_milestones FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_milestones.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_milestones.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
);

-- Users can view milestones for projects they have access to
CREATE POLICY "Users can view milestones for accessible projects"
ON public.project_milestones FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_milestones.project_id
    )
);

-- -----------------------------------------------------------------------------
-- PROJECT TASKS POLICIES
-- -----------------------------------------------------------------------------

-- Staff can manage all tasks
CREATE POLICY "Staff can manage all project tasks"
ON public.project_tasks FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- Partners can manage tasks for their projects
CREATE POLICY "Partners can manage tasks for their projects"
ON public.project_tasks FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_tasks.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_tasks.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
);

-- Project members can manage tasks they're assigned to or create new tasks
CREATE POLICY "Project members can manage their tasks"
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

-- Users can view tasks for projects they have access to
CREATE POLICY "Users can view tasks for accessible projects"
ON public.project_tasks FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_tasks.project_id
    )
);

-- -----------------------------------------------------------------------------
-- PROJECT TASK COMMENTS POLICIES
-- -----------------------------------------------------------------------------

-- Staff can manage all task comments
CREATE POLICY "Staff can manage all task comments"
ON public.project_task_comments FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- Users can view comments on tasks they can see
CREATE POLICY "Users can view task comments"
ON public.project_task_comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.project_tasks t
        WHERE t.id = project_task_comments.task_id
    )
);

-- Users can create comments on tasks they can access
CREATE POLICY "Users can create task comments"
ON public.project_task_comments FOR INSERT
TO authenticated
WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.project_tasks t
        WHERE t.id = project_task_comments.task_id
    )
);

-- Users can update/delete their own comments
CREATE POLICY "Users can manage own task comments"
ON public.project_task_comments FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can delete own task comments"
ON public.project_task_comments FOR DELETE
TO authenticated
USING (author_id = auth.uid());

-- -----------------------------------------------------------------------------
-- PROJECT TIME ENTRIES POLICIES
-- -----------------------------------------------------------------------------

-- Staff can manage all time entries
CREATE POLICY "Staff can manage all project time entries"
ON public.project_time_entries FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

-- Partners can view time entries for their projects
CREATE POLICY "Partners can view time entries for their projects"
ON public.project_time_entries FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_time_entries.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
);

-- Project members can create time entries
CREATE POLICY "Project members can create time entries"
ON public.project_time_entries FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_time_entries.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = TRUE
    )
);

-- Users can manage their own time entries
CREATE POLICY "Users can manage own time entries"
ON public.project_time_entries FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own time entries"
ON public.project_time_entries FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Users can view their own time entries
CREATE POLICY "Users can view own time entries"
ON public.project_time_entries FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Clients can view time entries for their project (for transparency)
CREATE POLICY "Clients can view project time entries"
ON public.project_time_entries FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.project_organizations po
        WHERE po.project_id = project_time_entries.project_id
        AND po.organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
        AND po.is_active = TRUE
    )
);

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_time_entries TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.project_tasks_task_number_seq TO authenticated;
