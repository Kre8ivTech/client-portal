-- Migration: Add plan_assignment_id and work_type to time_entries
-- Description: Links time entries to plan assignments and tracks support vs dev hours
-- Date: 2026-02-01

-- =============================================================================
-- ADD WORK TYPE ENUM
-- =============================================================================

-- Reuse coverage_type enum for work_type (support, dev)
-- No new enum needed, we'll use coverage_type

-- =============================================================================
-- ADD COLUMNS TO TIME_ENTRIES
-- =============================================================================

-- Add plan_assignment_id to link time entries to a specific plan assignment
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS plan_assignment_id UUID REFERENCES public.plan_assignments(id) ON DELETE SET NULL;

-- Add work_type to track support vs development hours
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS work_type coverage_type NOT NULL DEFAULT 'support';

-- Create index for efficient queries by plan assignment
CREATE INDEX IF NOT EXISTS idx_time_entries_plan_assignment
  ON public.time_entries(plan_assignment_id)
  WHERE plan_assignment_id IS NOT NULL;

-- Create index for work_type queries
CREATE INDEX IF NOT EXISTS idx_time_entries_work_type
  ON public.time_entries(work_type);

-- Composite index for calculating hours used per plan assignment
CREATE INDEX IF NOT EXISTS idx_time_entries_plan_hours
  ON public.time_entries(plan_assignment_id, work_type, billable)
  WHERE plan_assignment_id IS NOT NULL AND billable = true;

-- =============================================================================
-- FUNCTION: Calculate hours used for a plan assignment
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_plan_hours_used(
  p_plan_assignment_id UUID,
  p_work_type coverage_type DEFAULT NULL
)
RETURNS NUMERIC(10, 2) AS $$
DECLARE
  v_total_hours NUMERIC(10, 2);
BEGIN
  IF p_work_type IS NULL THEN
    -- Return total of all billable hours
    SELECT COALESCE(SUM(hours), 0) INTO v_total_hours
    FROM public.time_entries
    WHERE plan_assignment_id = p_plan_assignment_id
      AND billable = true;
  ELSE
    -- Return hours for specific work type
    SELECT COALESCE(SUM(hours), 0) INTO v_total_hours
    FROM public.time_entries
    WHERE plan_assignment_id = p_plan_assignment_id
      AND work_type = p_work_type
      AND billable = true;
  END IF;

  RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- FUNCTION: Sync plan assignment hours from time entries
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_plan_assignment_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- If a time entry is added, updated, or deleted with a plan_assignment_id
  -- Recalculate the hours used in the plan_assignment

  IF TG_OP = 'DELETE' AND OLD.plan_assignment_id IS NOT NULL THEN
    UPDATE public.plan_assignments
    SET
      support_hours_used = calculate_plan_hours_used(OLD.plan_assignment_id, 'support'),
      dev_hours_used = calculate_plan_hours_used(OLD.plan_assignment_id, 'dev'),
      updated_at = now()
    WHERE id = OLD.plan_assignment_id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' AND NEW.plan_assignment_id IS NOT NULL THEN
    UPDATE public.plan_assignments
    SET
      support_hours_used = calculate_plan_hours_used(NEW.plan_assignment_id, 'support'),
      dev_hours_used = calculate_plan_hours_used(NEW.plan_assignment_id, 'dev'),
      updated_at = now()
    WHERE id = NEW.plan_assignment_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update old plan assignment if it changed
    IF OLD.plan_assignment_id IS NOT NULL AND (NEW.plan_assignment_id IS NULL OR OLD.plan_assignment_id != NEW.plan_assignment_id) THEN
      UPDATE public.plan_assignments
      SET
        support_hours_used = calculate_plan_hours_used(OLD.plan_assignment_id, 'support'),
        dev_hours_used = calculate_plan_hours_used(OLD.plan_assignment_id, 'dev'),
        updated_at = now()
      WHERE id = OLD.plan_assignment_id;
    END IF;
    -- Update new plan assignment
    IF NEW.plan_assignment_id IS NOT NULL THEN
      UPDATE public.plan_assignments
      SET
        support_hours_used = calculate_plan_hours_used(NEW.plan_assignment_id, 'support'),
        dev_hours_used = calculate_plan_hours_used(NEW.plan_assignment_id, 'dev'),
        updated_at = now()
      WHERE id = NEW.plan_assignment_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-sync hours
DROP TRIGGER IF EXISTS sync_plan_hours_on_time_entry ON public.time_entries;
CREATE TRIGGER sync_plan_hours_on_time_entry
  AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_plan_assignment_hours();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN public.time_entries.plan_assignment_id IS 'Links time entry to a specific plan assignment for hour tracking';
COMMENT ON COLUMN public.time_entries.work_type IS 'Type of work: support or dev (determines which hour pool is consumed)';
COMMENT ON FUNCTION calculate_plan_hours_used IS 'Calculate total billable hours used for a plan assignment, optionally filtered by work type';
COMMENT ON FUNCTION sync_plan_assignment_hours IS 'Trigger function to keep plan_assignment hour counts in sync with time_entries';
