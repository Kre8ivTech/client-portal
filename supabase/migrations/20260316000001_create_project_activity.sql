-- Create the project_activity table that is referenced throughout the codebase
-- but was never created in a migration.

CREATE TABLE IF NOT EXISTS project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_project_activity_project_id ON project_activity(project_id);
CREATE INDEX idx_project_activity_created_at ON project_activity(created_at DESC);
CREATE INDEX idx_project_activity_user_id ON project_activity(user_id);

-- Enable RLS
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

-- Users can view activity for projects they have access to
CREATE POLICY "Users can view project activity for accessible projects"
  ON project_activity FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm
      JOIN users u ON u.id = auth.uid()
      WHERE pm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'staff')
    )
  );

-- Staff and admins can insert activity
CREATE POLICY "Authenticated users can insert project activity"
  ON project_activity FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only super_admin can delete activity
CREATE POLICY "Super admins can delete project activity"
  ON project_activity FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );
