-- Project Tasks table
CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  start_date date,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  tags jsonb DEFAULT '[]'::jsonb,
  estimated_hours numeric,
  actual_hours numeric,
  parent_task_id uuid REFERENCES project_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project Files table
CREATE TABLE IF NOT EXISTS project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  folder text DEFAULT '/',
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project Comments table (for tasks and general project discussion)
CREATE TABLE IF NOT EXISTS project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project Activity Log
CREATE TABLE IF NOT EXISTS project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON project_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_folder ON project_files(project_id, folder);
CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_task_id ON project_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_project_id ON project_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_created_at ON project_activity(created_at DESC);

-- RLS Policies
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

-- Project Tasks RLS
CREATE POLICY "Staff can manage all project tasks" ON project_tasks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
  );

CREATE POLICY "Project members can view project tasks" ON project_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_tasks.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM project_organizations po
      JOIN users u ON u.organization_id = po.organization_id
      WHERE po.project_id = project_tasks.project_id
        AND u.id = auth.uid()
        AND po.is_active = true
    )
  );

CREATE POLICY "Project members can manage tasks" ON project_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_tasks.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = true
        AND pm.role IN ('project_manager', 'account_manager', 'team_member')
    )
  );

-- Project Files RLS
CREATE POLICY "Staff can manage all project files" ON project_files FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
  );

CREATE POLICY "Project members can view project files" ON project_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_files.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM project_organizations po
      JOIN users u ON u.organization_id = po.organization_id
      WHERE po.project_id = project_files.project_id
        AND u.id = auth.uid()
        AND po.is_active = true
    )
  );

CREATE POLICY "Project members can upload files" ON project_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_files.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = true
        AND pm.role IN ('project_manager', 'account_manager', 'team_member')
    )
  );

-- Project Comments RLS
CREATE POLICY "Staff can manage all project comments" ON project_comments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
  );

CREATE POLICY "Project members can view comments" ON project_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_comments.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM project_organizations po
      JOIN users u ON u.organization_id = po.organization_id
      WHERE po.project_id = project_comments.project_id
        AND u.id = auth.uid()
        AND po.is_active = true
    )
  );

CREATE POLICY "Project members can create comments" ON project_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = project_comments.project_id
          AND pm.user_id = auth.uid()
          AND pm.is_active = true
      )
      OR
      EXISTS (
        SELECT 1 FROM project_organizations po
        JOIN users u ON u.organization_id = po.organization_id
        WHERE po.project_id = project_comments.project_id
          AND u.id = auth.uid()
          AND po.is_active = true
      )
    )
  );

CREATE POLICY "Authors can update own comments" ON project_comments FOR UPDATE
  USING (auth.uid() = author_id);

-- Project Activity RLS
CREATE POLICY "Staff can manage all project activity" ON project_activity FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
  );

CREATE POLICY "Project members can view activity" ON project_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_activity.project_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM project_organizations po
      JOIN users u ON u.organization_id = po.organization_id
      WHERE po.project_id = project_activity.project_id
        AND u.id = auth.uid()
        AND po.is_active = true
    )
  );

CREATE POLICY "Authenticated users can insert activity" ON project_activity FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
