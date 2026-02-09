-- Migration: Allow project members to see each other's user/profile data
-- Description: Adds RLS policies so users who share a project can view each other
--   in the users and profiles tables. Uses a SECURITY DEFINER function to avoid
--   circular RLS issues.
-- Date: 2026-02-09

-- =============================================================================
-- SECURITY DEFINER FUNCTION: Check if target user shares a project with caller
-- =============================================================================

CREATE OR REPLACE FUNCTION is_shared_project_member(target_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = target_user_id
      AND pm2.user_id = auth.uid()
      AND pm1.is_active = true
      AND pm2.is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_shared_project_member(UUID) IS
  'Returns true if the target user shares at least one active project with the calling user. SECURITY DEFINER to bypass RLS on project_members.';

-- =============================================================================
-- USERS TABLE: Allow viewing fellow project members
-- =============================================================================

CREATE POLICY "Users can view fellow project members"
  ON public.users FOR SELECT
  USING (is_shared_project_member(id));

-- =============================================================================
-- PROFILES TABLE: Allow viewing fellow project member profiles
-- =============================================================================

CREATE POLICY "Users can view fellow project member profiles"
  ON public.profiles FOR SELECT
  USING (is_shared_project_member(user_id));
