-- Migration: Add folder column and direct-upload support to organization_files
-- Description: Adds a `folder` column for logical folder grouping and an index
--   on (organization_id, owner_user_id) to optimize client-isolated queries.
-- Date: 2026-02-08

-- 1. Add folder column for logical grouping of uploaded files
ALTER TABLE public.organization_files
  ADD COLUMN IF NOT EXISTS folder TEXT;

-- 2. Index for efficient client-folder queries (list files by owner within an org)
CREATE INDEX IF NOT EXISTS idx_org_files_org_owner
  ON public.organization_files(organization_id, owner_user_id);

-- 3. Index for folder-based filtering
CREATE INDEX IF NOT EXISTS idx_org_files_folder
  ON public.organization_files(organization_id, folder)
  WHERE folder IS NOT NULL;
