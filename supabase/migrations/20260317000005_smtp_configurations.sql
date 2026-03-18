-- SMTP configurations for global and white-label organization email sending

CREATE TABLE IF NOT EXISTS smtp_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL CHECK (port > 0 AND port < 65536),
  secure BOOLEAN NOT NULL DEFAULT true,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  password_iv TEXT NOT NULL,
  password_auth_tag TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (organization_id)
);

COMMENT ON TABLE smtp_configurations IS 'SMTP credentials for email provider override. organization_id NULL = global fallback.';

ALTER TABLE smtp_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "smtp_super_admin_select" ON smtp_configurations;
CREATE POLICY "smtp_super_admin_select"
  ON smtp_configurations FOR SELECT
  USING (
    is_super_admin()
    OR organization_id = get_user_organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "smtp_super_admin_manage" ON smtp_configurations;
CREATE POLICY "smtp_super_admin_manage"
  ON smtp_configurations FOR ALL
  USING (
    is_super_admin()
    OR organization_id = get_user_organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_user_organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_org_id = get_user_organization_id()
    )
  );

CREATE INDEX IF NOT EXISTS idx_smtp_configurations_org ON smtp_configurations(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_smtp_single_global
  ON smtp_configurations ((organization_id IS NULL))
  WHERE organization_id IS NULL;

DROP TRIGGER IF EXISTS update_smtp_configurations_updated_at ON smtp_configurations;
CREATE TRIGGER update_smtp_configurations_updated_at
  BEFORE UPDATE ON smtp_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
