-- Enforce account state and MFA at the database boundary so browser clients
-- cannot bypass application-level checks by calling Supabase directly.

CREATE OR REPLACE FUNCTION public.current_user_meets_access_policy()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    LEFT JOIN public.organizations AS organization
      ON organization.id = app_user.organization_id
    LEFT JOIN public.app_settings AS settings
      ON settings.id = '00000000-0000-0000-0000-000000000001'::UUID
    WHERE app_user.id = (SELECT auth.uid())
      AND app_user.status = 'active'
      AND (
        app_user.organization_id IS NULL
        OR organization.status = 'active'
      )
      AND (
        COALESCE(settings.mfa_enabled, TRUE) = FALSE
        OR NOT (
          COALESCE(app_user.mfa_enabled, FALSE)
          OR (
            app_user.role IN ('super_admin', 'admin', 'staff', 'partner', 'partner_staff')
            AND COALESCE(settings.mfa_required_for_staff, FALSE)
          )
          OR (
            app_user.role = 'client'
            AND COALESCE(settings.mfa_required_for_clients, FALSE)
          )
        )
        OR COALESCE((SELECT auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_meets_access_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_meets_access_policy() TO authenticated, service_role;

-- Expose only non-secret MFA policy booleans to authenticated sessions. The
-- app_settings row itself remains restricted because it contains credentials.
CREATE OR REPLACE FUNCTION public.get_current_mfa_policy()
RETURNS TABLE (
  mfa_enabled BOOLEAN,
  mfa_required_for_staff BOOLEAN,
  mfa_required_for_clients BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(settings.mfa_enabled, TRUE),
    COALESCE(settings.mfa_required_for_staff, FALSE),
    COALESCE(settings.mfa_required_for_clients, FALSE)
  FROM (VALUES (1)) AS singleton(value)
  LEFT JOIN public.app_settings AS settings
    ON settings.id = '00000000-0000-0000-0000-000000000001'::UUID;
$$;

REVOKE ALL ON FUNCTION public.get_current_mfa_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_mfa_policy() TO authenticated, service_role;

-- Add a restrictive policy to every existing RLS-protected public table except
-- the two tables required to determine the policy itself. Existing permissive
-- tenant policies continue to apply in addition to this mandatory gate.
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT c.relname AS table_name
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND c.relname NOT IN ('users', 'app_settings')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Enforce active account and MFA',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.current_user_meets_access_policy())) WITH CHECK ((SELECT public.current_user_meets_access_policy()))',
      'Enforce active account and MFA',
      table_record.table_name
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND c.relrowsecurity
  ) THEN
    DROP POLICY IF EXISTS "Enforce active account and MFA" ON storage.objects;
    CREATE POLICY "Enforce active account and MFA"
      ON storage.objects
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING ((SELECT public.current_user_meets_access_policy()))
      WITH CHECK ((SELECT public.current_user_meets_access_policy()));
  END IF;
END;
$$;

-- RLS controls which rows can be updated, not which columns can be changed.
-- Prevent non-admin users from promoting themselves or moving tenants while
-- preserving legitimate self-service preference and MFA updates.
CREATE OR REPLACE FUNCTION public.protect_user_authorization_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF (SELECT auth.role()) <> 'authenticated' OR (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT users.role
  INTO actor_role
  FROM public.users
  WHERE users.id = (SELECT auth.uid());

  IF COALESCE(actor_role, '') NOT IN ('super_admin', 'admin') AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.is_account_manager IS DISTINCT FROM OLD.is_account_manager
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'authorization fields may only be changed by an administrator'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(actor_role, '') NOT IN ('super_admin', 'admin')
    AND (
      NEW.mfa_enabled IS DISTINCT FROM OLD.mfa_enabled
      OR NEW.mfa_verified_at IS DISTINCT FROM OLD.mfa_verified_at
    )
    AND COALESCE((SELECT auth.jwt() ->> 'aal'), 'aal1') <> 'aal2'
  THEN
    RAISE EXCEPTION 'MFA settings require an AAL2 session'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_authorization_fields ON public.users;
CREATE TRIGGER protect_user_authorization_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_authorization_fields();

REVOKE ALL ON FUNCTION public.protect_user_authorization_fields() FROM PUBLIC;

CREATE INDEX IF NOT EXISTS error_logs_user_created_at_idx
  ON public.error_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
