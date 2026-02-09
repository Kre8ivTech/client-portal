-- Migration: Project Tasks, Comments, Files, and Communication Settings
-- Description: Adds task management, comments, file storage, and communication
--   settings tables for the project management dashboard.
-- Date: 2026-02-09

-- =============================================================================
-- PROJECT TASKS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Task details
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Classification
    status VARCHAR(30) NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),

    -- Assignment
    assigned_to UUID REFERENCES public.users(id),

    -- Dates
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,

    -- Progress
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- Ordering and dependencies
    sort_order INTEGER DEFAULT 0,
    parent_task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,

    -- Audit
    created_by UUID NOT NULL REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_tasks_project ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON public.project_tasks(project_id, status);
CREATE INDEX idx_project_tasks_assigned ON public.project_tasks(assigned_to);
CREATE INDEX idx_project_tasks_due_date ON public.project_tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_project_tasks_parent ON public.project_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_project_tasks_sort ON public.project_tasks(project_id, sort_order);

COMMENT ON TABLE public.project_tasks IS 'Tasks within a project for tracking work items';

CREATE TRIGGER update_project_tasks_updated_at
    BEFORE UPDATE ON public.project_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PROJECT COMMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Comment content
    content TEXT NOT NULL,
    content_html TEXT,

    -- Threading
    parent_comment_id UUID REFERENCES public.project_comments(id) ON DELETE CASCADE,

    -- Pinned for important announcements
    is_pinned BOOLEAN DEFAULT FALSE,

    -- Audit
    created_by UUID NOT NULL REFERENCES public.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_comments_project ON public.project_comments(project_id);
CREATE INDEX idx_project_comments_created ON public.project_comments(project_id, created_at DESC);
CREATE INDEX idx_project_comments_parent ON public.project_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_project_comments_pinned ON public.project_comments(project_id) WHERE is_pinned = TRUE;

COMMENT ON TABLE public.project_comments IS 'Discussion comments and messages on projects';

CREATE TRIGGER update_project_comments_updated_at
    BEFORE UPDATE ON public.project_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PROJECT FILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- File info
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(255),
    storage_path TEXT NOT NULL,

    -- Organization
    folder VARCHAR(255) DEFAULT 'General',

    -- Description
    description TEXT,

    -- Audit
    uploaded_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_files_project ON public.project_files(project_id);
CREATE INDEX idx_project_files_folder ON public.project_files(project_id, folder);
CREATE INDEX idx_project_files_mime ON public.project_files(project_id, mime_type);
CREATE INDEX idx_project_files_uploaded ON public.project_files(uploaded_by);

COMMENT ON TABLE public.project_files IS 'Files and media uploaded to projects organized by folder';

CREATE TRIGGER update_project_files_updated_at
    BEFORE UPDATE ON public.project_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PROJECT COMMUNICATION SETTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_communication_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Email notification preferences
    email_on_comment BOOLEAN DEFAULT TRUE,
    email_on_task_assigned BOOLEAN DEFAULT TRUE,
    email_on_task_completed BOOLEAN DEFAULT TRUE,
    email_on_file_uploaded BOOLEAN DEFAULT TRUE,
    email_on_status_change BOOLEAN DEFAULT TRUE,

    -- Digest frequency
    digest_frequency VARCHAR(20) DEFAULT 'instant'
        CHECK (digest_frequency IN ('instant', 'daily', 'weekly', 'none')),

    -- Allowed communication channels
    allow_client_comments BOOLEAN DEFAULT TRUE,
    allow_client_file_upload BOOLEAN DEFAULT TRUE,

    -- Auto-notifications
    notify_on_overdue_tasks BOOLEAN DEFAULT TRUE,
    overdue_reminder_days INTEGER DEFAULT 1,

    -- Audit
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id)
);

CREATE INDEX idx_project_comm_settings_project ON public.project_communication_settings(project_id);

COMMENT ON TABLE public.project_communication_settings IS 'Per-project communication and notification settings';

CREATE TRIGGER update_project_comm_settings_updated_at
    BEFORE UPDATE ON public.project_communication_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_communication_settings ENABLE ROW LEVEL SECURITY;

-- PROJECT TASKS POLICIES
-- Staff can manage all
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

-- Users can manage tasks on accessible projects
CREATE POLICY "Project members can manage tasks"
ON public.project_tasks FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_tasks.project_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_tasks.project_id
    )
);

-- PROJECT COMMENTS POLICIES
CREATE POLICY "Staff can manage all project comments"
ON public.project_comments FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

CREATE POLICY "Project members can view and create comments"
ON public.project_comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_comments.project_id
    )
);

CREATE POLICY "Authenticated users can insert comments on accessible projects"
ON public.project_comments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_comments.project_id
    )
    AND created_by = auth.uid()
);

CREATE POLICY "Users can update their own comments"
ON public.project_comments FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own comments"
ON public.project_comments FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- PROJECT FILES POLICIES
CREATE POLICY "Staff can manage all project files"
ON public.project_files FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

CREATE POLICY "Project members can view files"
ON public.project_files FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_files.project_id
    )
);

CREATE POLICY "Authenticated users can upload files to accessible projects"
ON public.project_files FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_files.project_id
    )
    AND uploaded_by = auth.uid()
);

CREATE POLICY "Users can delete their own files"
ON public.project_files FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- PROJECT COMMUNICATION SETTINGS POLICIES
CREATE POLICY "Staff can manage all communication settings"
ON public.project_communication_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

CREATE POLICY "Partners can manage communication settings for their projects"
ON public.project_communication_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_communication_settings.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_communication_settings.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
);

CREATE POLICY "Users can view communication settings for accessible projects"
ON public.project_communication_settings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_communication_settings.project_id
    )
);

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_communication_settings TO authenticated;
