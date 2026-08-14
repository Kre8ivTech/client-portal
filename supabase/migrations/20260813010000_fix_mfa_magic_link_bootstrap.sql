-- Allow an active AAL1 session to read its organization long enough for the
-- application middleware to determine whether MFA enrollment or a challenge
-- is required. Organization mutations remain protected by the full account
-- and MFA policy.

CREATE OR REPLACE FUNCTION public.current_user_can_read_security_bootstrap()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = (SELECT auth.uid())
      AND app_user.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_read_security_bootstrap() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_read_security_bootstrap()
  TO authenticated, service_role;

DROP POLICY IF EXISTS "Enforce active account and MFA" ON public.organizations;
DROP POLICY IF EXISTS "Allow security bootstrap reads" ON public.organizations;
DROP POLICY IF EXISTS "Enforce organization insert security" ON public.organizations;
DROP POLICY IF EXISTS "Enforce organization update security" ON public.organizations;
DROP POLICY IF EXISTS "Enforce organization delete security" ON public.organizations;

CREATE POLICY "Allow security bootstrap reads"
  ON public.organizations
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING ((SELECT public.current_user_can_read_security_bootstrap()));

CREATE POLICY "Enforce organization insert security"
  ON public.organizations
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.current_user_meets_access_policy()));

CREATE POLICY "Enforce organization update security"
  ON public.organizations
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.current_user_meets_access_policy()))
  WITH CHECK ((SELECT public.current_user_meets_access_policy()));

CREATE POLICY "Enforce organization delete security"
  ON public.organizations
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT public.current_user_meets_access_policy()));
