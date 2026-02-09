-- Migration: Fix project_tasks schema cache for progress and updated_by columns
-- Description: Ensures progress and updated_by columns exist on project_tasks
--   and refreshes PostgREST schema cache. The original migration
--   (20260209200000) creates the table with these columns, but PostgREST may
--   not have reloaded its schema cache after the DDL changes.
-- Date: 2026-02-09

-- Safety net: add columns if they don't exist (no-op if they already do)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'project_tasks'
          AND column_name = 'progress'
    ) THEN
        ALTER TABLE public.project_tasks
            ADD COLUMN progress INTEGER DEFAULT 0
            CHECK (progress >= 0 AND progress <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'project_tasks'
          AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE public.project_tasks
            ADD COLUMN updated_by UUID REFERENCES public.users(id);
    END IF;
END
$$;

-- Refresh PostgREST schema cache so it picks up the columns
NOTIFY pgrst, 'reload schema';
