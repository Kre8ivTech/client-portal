-- Align legacy `admin` role with super-admin privileges (app + RLS).
-- feature_settings and other policies already reference ('admin', 'super_admin'); users.role CHECK did not allow `admin`.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'users'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'super_admin',
    'admin',
    'staff',
    'partner',
    'partner_staff',
    'client'
  )
);

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_staff() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'staff')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_staff_or_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff', 'super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
