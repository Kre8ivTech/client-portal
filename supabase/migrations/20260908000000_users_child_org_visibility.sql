-- Migration: Allow partners / account managers to view users in their child organizations
-- Description:
--   The invoice creation flow (and other partner-facing screens) expand scope to include
--   child (client) organizations via organizations.parent_org_id. However, the users/profiles
--   SELECT RLS policies only permitted viewing users in the caller's OWN organization
--   (or self, or super_admin). As a result, a staff account manager or partner could only
--   ever see client users in their own org, so the invoice "Client" dropdown showed a single
--   client even when multiple child-org clients existed.
--
--   This migration adds a SECURITY DEFINER helper to test whether a target user's organization
--   is a child of the caller's organization, and grants SELECT on users/profiles accordingly.
--   SECURITY DEFINER is used to avoid RLS recursion (error 42P17) that this codebase has
--   previously hit with inline subqueries against public.users.
-- Date: 2026-09-08

-- =============================================================================
-- 1. HELPER: is user in one of the caller's child organizations?
-- =============================================================================

CREATE OR REPLACE FUNCTION is_child_org_member(target_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users target
    JOIN public.organizations child
      ON child.id = target.organization_id
    WHERE target.id = target_user_id
      AND child.parent_org_id = (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_child_org_member(UUID) IS
  'Returns true if the target user belongs to an organization whose parent_org_id is the caller''s organization. SECURITY DEFINER to bypass RLS on users/organizations and avoid recursion.';

-- =============================================================================
-- 2. USERS: allow viewing members of child organizations
-- =============================================================================

DROP POLICY IF EXISTS "Users can view child org members" ON public.users;

CREATE POLICY "Users can view child org members"
  ON public.users FOR SELECT
  USING (is_child_org_member(id));

-- =============================================================================
-- 3. PROFILES: allow viewing profiles of child organization members
-- =============================================================================

DROP POLICY IF EXISTS "Users can view child org member profiles" ON public.profiles;

CREATE POLICY "Users can view child org member profiles"
  ON public.profiles FOR SELECT
  USING (is_child_org_member(user_id));

GRANT EXECUTE ON FUNCTION is_child_org_member(UUID) TO authenticated;
