-- Migration: Let partners find platform staff they are already allowed to message
-- Description:
--   can_message_user() lets a partner or partner_staff message users in the
--   parent organization (the platform org). users/profiles SELECT policies only
--   covered the caller's own org, child orgs, and shared projects, so the
--   new-message search could not return that parent-org staff.
--   This adds a SECURITY DEFINER check and SELECT policies for parent-org
--   platform staff (super_admin, admin, staff) only. Clients stay limited to
--   their own organization. Other organizations stay hidden.
-- Date: 2026-10-02

-- =============================================================================
-- 1. HELPER: is the target user platform staff in the caller's parent org?
-- =============================================================================

CREATE OR REPLACE FUNCTION is_parent_org_platform_staff(target_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users caller
    JOIN public.organizations caller_org
      ON caller_org.id = caller.organization_id
    JOIN public.users target
      ON target.id = target_user_id
    WHERE caller.id = auth.uid()
      AND caller.role IN ('partner', 'partner_staff')
      AND caller_org.parent_org_id IS NOT NULL
      AND target.organization_id = caller_org.parent_org_id
      AND target.organization_id IS DISTINCT FROM caller.organization_id
      AND target.role IN ('super_admin', 'admin', 'staff')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_parent_org_platform_staff(UUID) IS
  'Returns true when the caller is a partner or partner_staff and the target is platform staff in the caller organization''s parent. SECURITY DEFINER to bypass RLS and avoid recursion.';

-- =============================================================================
-- 2. USERS + PROFILES: partners can view that parent-org platform staff
-- =============================================================================

DROP POLICY IF EXISTS "Partners can view parent org platform staff" ON public.users;

CREATE POLICY "Partners can view parent org platform staff"
  ON public.users FOR SELECT
  USING (is_parent_org_platform_staff(id));

DROP POLICY IF EXISTS "Partners can view parent org platform staff profiles" ON public.profiles;

CREATE POLICY "Partners can view parent org platform staff profiles"
  ON public.profiles FOR SELECT
  USING (is_parent_org_platform_staff(user_id));

GRANT EXECUTE ON FUNCTION is_parent_org_platform_staff(UUID) TO authenticated;
