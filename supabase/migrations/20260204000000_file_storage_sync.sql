-- Migration: File storage sync (Drive/OneDrive/Dropbox -> S3) + org separation
-- Description: Adds org-scoped S3 destination settings, file index, and sync run tracking.
-- Date: 2026-02-04

-- =============================================================================
-- 1. EXTEND OAUTH INTEGRATIONS (provider-specific sync metadata/state)
-- =============================================================================

ALTER TABLE public.oauth_integrations
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.oauth_integrations
  ADD COLUMN IF NOT EXISTS sync_cursor TEXT;

-- =============================================================================
-- 2. ORG FILE STORAGE SETTINGS (S3 destination configuration per org)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organization_file_storage_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Optional S3 key prefix override. If NULL, app uses `org/<org_id>/...`
  s3_prefix TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_file_storage_settings_org
  ON public.organization_file_storage_settings(organization_id);

DROP TRIGGER IF EXISTS update_org_file_storage_settings_updated_at ON public.organization_file_storage_settings;
CREATE TRIGGER update_org_file_storage_settings_updated_at
  BEFORE UPDATE ON public.organization_file_storage_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.organization_file_storage_settings ENABLE ROW LEVEL SECURITY;

-- Org members (and partner-parent org) can view the settings; admins/staff can view all.
DROP POLICY IF EXISTS "Org members can view file storage settings" ON public.organization_file_storage_settings;
CREATE POLICY "Org members can view file storage settings"
  ON public.organization_file_storage_settings FOR SELECT
  USING (
    is_admin_or_staff()
    OR organization_id = get_user_organization_id()
    OR organization_id IN (
      SELECT id FROM public.organizations
      WHERE parent_org_id = get_user_organization_id()
    )
  );

-- Only admin/staff can create/update/delete settings rows (secure default).
DROP POLICY IF EXISTS "Admin/staff can manage file storage settings" ON public.organization_file_storage_settings;
CREATE POLICY "Admin/staff can manage file storage settings"
  ON public.organization_file_storage_settings FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- =============================================================================
-- 3. ORG FILE INDEX (tracks files synced into S3, scoped by organization)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organization_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  oauth_integration_id UUID REFERENCES public.oauth_integrations(id) ON DELETE SET NULL,
  source_provider TEXT NOT NULL, -- 'google_drive' | 'microsoft_onedrive' | 'dropbox'
  source_file_id TEXT NOT NULL,
  source_path TEXT,
  name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  s3_bucket TEXT,
  s3_key TEXT NOT NULL,
  checksum TEXT,
  external_modified_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, source_provider, source_file_id)
);

CREATE INDEX IF NOT EXISTS idx_org_files_org ON public.organization_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_files_owner ON public.organization_files(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_org_files_provider ON public.organization_files(source_provider);
CREATE INDEX IF NOT EXISTS idx_org_files_synced_at ON public.organization_files(synced_at);

DROP TRIGGER IF EXISTS update_organization_files_updated_at ON public.organization_files;
CREATE TRIGGER update_organization_files_updated_at
  BEFORE UPDATE ON public.organization_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.organization_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org files" ON public.organization_files;
CREATE POLICY "Users can view org files"
  ON public.organization_files FOR SELECT
  USING (
    is_admin_or_staff()
    OR organization_id = get_user_organization_id()
    OR organization_id IN (
      SELECT id FROM public.organizations
      WHERE parent_org_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert org files for their org" ON public.organization_files;
CREATE POLICY "Users can insert org files for their org"
  ON public.organization_files FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

DROP POLICY IF EXISTS "Users can update own org files" ON public.organization_files;
CREATE POLICY "Users can update own org files"
  ON public.organization_files FOR UPDATE
  USING (
    is_admin_or_staff()
    OR (owner_user_id = auth.uid() AND organization_id = get_user_organization_id())
  )
  WITH CHECK (
    is_admin_or_staff()
    OR (owner_user_id = auth.uid() AND organization_id = get_user_organization_id())
  );

DROP POLICY IF EXISTS "Users can delete own org files" ON public.organization_files;
CREATE POLICY "Users can delete own org files"
  ON public.organization_files FOR DELETE
  USING (
    is_admin_or_staff()
    OR (owner_user_id = auth.uid() AND organization_id = get_user_organization_id())
  );

-- =============================================================================
-- 4. SYNC RUN TRACKING (auditable, org-scoped)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.file_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- 'google_drive' | 'microsoft_onedrive' | 'dropbox'
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'error')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_sync_runs_org ON public.file_sync_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_sync_runs_user ON public.file_sync_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_sync_runs_provider ON public.file_sync_runs(provider);
CREATE INDEX IF NOT EXISTS idx_file_sync_runs_created_at ON public.file_sync_runs(created_at);

DROP TRIGGER IF EXISTS update_file_sync_runs_updated_at ON public.file_sync_runs;
CREATE TRIGGER update_file_sync_runs_updated_at
  BEFORE UPDATE ON public.file_sync_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.file_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org sync runs" ON public.file_sync_runs;
CREATE POLICY "Users can view org sync runs"
  ON public.file_sync_runs FOR SELECT
  USING (
    is_admin_or_staff()
    OR organization_id = get_user_organization_id()
    OR organization_id IN (
      SELECT id FROM public.organizations
      WHERE parent_org_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can create own sync runs" ON public.file_sync_runs;
CREATE POLICY "Users can create own sync runs"
  ON public.file_sync_runs FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own sync runs" ON public.file_sync_runs;
CREATE POLICY "Users can update own sync runs"
  ON public.file_sync_runs FOR UPDATE
  USING (
    is_admin_or_staff()
    OR (user_id = auth.uid() AND organization_id = get_user_organization_id())
  )
  WITH CHECK (
    is_admin_or_staff()
    OR (user_id = auth.uid() AND organization_id = get_user_organization_id())
  );

