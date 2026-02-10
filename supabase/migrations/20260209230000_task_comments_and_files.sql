-- Migration: Add task comments and task files support
-- Description: Enable individual project tasks to have their own comments and file attachments

-- ============================================================================
-- TASK COMMENTS TABLE
-- ============================================================================
-- Stores comments/discussion on individual project tasks
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_html TEXT, -- Optional: for rich text rendering
  parent_comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE, -- For nested replies
  is_internal BOOLEAN DEFAULT false, -- For internal team notes vs client-visible
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT task_comments_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Indexes for performance
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_created_by ON task_comments(created_by);
CREATE INDEX idx_task_comments_parent ON task_comments(parent_comment_id);
CREATE INDEX idx_task_comments_created_at ON task_comments(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TASK FILES TABLE
-- ============================================================================
-- Stores file attachments on individual project tasks
CREATE TABLE IF NOT EXISTS task_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- bytes
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- Supabase Storage path
  description TEXT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT task_files_file_size_positive CHECK (file_size > 0),
  CONSTRAINT task_files_file_name_not_empty CHECK (length(trim(file_name)) > 0)
);

-- Indexes for performance
CREATE INDEX idx_task_files_task_id ON task_files(task_id);
CREATE INDEX idx_task_files_uploaded_by ON task_files(uploaded_by);
CREATE INDEX idx_task_files_created_at ON task_files(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER task_files_updated_at
  BEFORE UPDATE ON task_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TASK COMMENTS RLS POLICIES
-- ============================================================================

-- Users can view task comments if they have access to the project
CREATE POLICY "Users can view task comments in their org projects"
  ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      WHERE pt.id = task_comments.task_id
      AND p.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Partners can view task comments in client projects
CREATE POLICY "Partners can view task comments in client projects"
  ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      JOIN organizations o ON o.id = p.organization_id
      WHERE pt.id = task_comments.task_id
      AND o.parent_org_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Project members can view task comments in their projects
CREATE POLICY "Project members can view task comments"
  ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN project_members pm ON pm.project_id = pt.project_id
      WHERE pt.id = task_comments.task_id
      AND pm.user_id = auth.uid()
      AND pm.is_active = true
    )
  );

-- Users can create comments on tasks in their org projects
CREATE POLICY "Users can create task comments in org projects"
  ON task_comments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      WHERE pt.id = task_comments.task_id
      AND p.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Project members can create comments
CREATE POLICY "Project members can create task comments"
  ON task_comments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN project_members pm ON pm.project_id = pt.project_id
      WHERE pt.id = task_comments.task_id
      AND pm.user_id = auth.uid()
      AND pm.is_active = true
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own task comments"
  ON task_comments FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own task comments"
  ON task_comments FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================================
-- TASK FILES RLS POLICIES
-- ============================================================================

-- Users can view task files if they have access to the project
CREATE POLICY "Users can view task files in their org projects"
  ON task_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      WHERE pt.id = task_files.task_id
      AND p.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Partners can view task files in client projects
CREATE POLICY "Partners can view task files in client projects"
  ON task_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      JOIN organizations o ON o.id = p.organization_id
      WHERE pt.id = task_files.task_id
      AND o.parent_org_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Project members can view task files
CREATE POLICY "Project members can view task files"
  ON task_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN project_members pm ON pm.project_id = pt.project_id
      WHERE pt.id = task_files.task_id
      AND pm.user_id = auth.uid()
      AND pm.is_active = true
    )
  );

-- Users can upload files to tasks in their org projects
CREATE POLICY "Users can upload task files in org projects"
  ON task_files FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      WHERE pt.id = task_files.task_id
      AND p.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Project members can upload files
CREATE POLICY "Project members can upload task files"
  ON task_files FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN project_members pm ON pm.project_id = pt.project_id
      WHERE pt.id = task_files.task_id
      AND pm.user_id = auth.uid()
      AND pm.is_active = true
    )
  );

-- Users can delete their own uploaded files
CREATE POLICY "Users can delete own task files"
  ON task_files FOR DELETE
  USING (uploaded_by = auth.uid());

-- Project managers can delete any task file in their projects
CREATE POLICY "Project managers can delete task files"
  ON task_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_tasks pt
      JOIN project_members pm ON pm.project_id = pt.project_id
      WHERE pt.id = task_files.task_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'project_manager'
      AND pm.is_active = true
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get task comment count
CREATE OR REPLACE FUNCTION get_task_comment_count(p_task_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM task_comments
  WHERE task_id = p_task_id;
$$ LANGUAGE SQL STABLE;

-- Function to get task file count
CREATE OR REPLACE FUNCTION get_task_file_count(p_task_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM task_files
  WHERE task_id = p_task_id;
$$ LANGUAGE SQL STABLE;

-- Function to get task total file size
CREATE OR REPLACE FUNCTION get_task_total_file_size(p_task_id UUID)
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(file_size), 0)
  FROM task_files
  WHERE task_id = p_task_id;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE task_comments IS 'Comments and discussion threads on individual project tasks';
COMMENT ON TABLE task_files IS 'File attachments on individual project tasks';

COMMENT ON COLUMN task_comments.is_internal IS 'If true, comment is only visible to team members, not clients';
COMMENT ON COLUMN task_comments.parent_comment_id IS 'For nested replies, references parent comment';
COMMENT ON COLUMN task_files.storage_path IS 'Path in Supabase Storage bucket';
