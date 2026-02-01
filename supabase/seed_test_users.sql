-- =============================================================================
-- Seed test users for each role: super_admin, staff, partner, partner_staff, client.
-- Password for all: TestPassword123!
--
-- Test accounts:
--   super-admin@test.example.com   -> super_admin  (Kre8ivTech)
--   staff@test.example.com         -> staff        (Kre8ivTech)
--   partner@test.example.com      -> partner      (Test Partner)
--   partner-staff@test.example.com -> partner_staff (Test Partner)
--   client@test.example.com       -> client       (Test Client Org)
--
-- Run in Supabase SQL Editor (Dashboard > SQL Editor) or:
--   psql "$DATABASE_URL" -f supabase/seed_test_users.sql
--
-- If auth.users inserts fail (e.g. missing pgcrypto or auth schema), create users
-- via Dashboard (Authentication > Users > Add user) with the emails above and
-- TestPassword123!, then run only sections 1 and 2 (orgs + update users/profiles).
-- =============================================================================

-- Ensure pgcrypto for bcrypt password hashing (needed if creating auth users in SQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. Organizations (idempotent)
-- =============================================================================

INSERT INTO public.organizations (name, slug, type, status)
VALUES ('Kre8ivTech, LLC', 'kre8ivtech', 'kre8ivtech', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organizations (name, slug, type, status)
VALUES ('Test Partner', 'test-partner', 'partner', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organizations (name, slug, type, status, parent_org_id)
SELECT 'Test Client Org', 'test-client', 'client', 'active', id
FROM public.organizations
WHERE slug = 'test-partner'
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 2. Create auth users (triggers handle_new_user -> public.users + public.profiles)
--    Then set role and organization on public.users, and name on public.profiles.
--    Skip auth insert if user already exists (by email).
-- =============================================================================

DO $$
DECLARE
  instance_uuid uuid;
  pwd_hash text;
  uid uuid;
  kre8ivtech_id uuid;
  partner_id uuid;
  client_id uuid;
BEGIN
  SELECT id INTO instance_uuid FROM auth.instances LIMIT 1;
  IF instance_uuid IS NULL THEN
    instance_uuid := '00000000-0000-0000-0000-000000000000';
  END IF;
  pwd_hash := crypt('TestPassword123!', gen_salt('bf'));

  SELECT id INTO kre8ivtech_id FROM public.organizations WHERE slug = 'kre8ivtech' LIMIT 1;
  SELECT id INTO partner_id   FROM public.organizations WHERE slug = 'test-partner' LIMIT 1;
  SELECT id INTO client_id   FROM public.organizations WHERE slug = 'test-client' LIMIT 1;

  -- super_admin
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'super-admin@test.example.com') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, raw_user_meta_data, created_at, updated_at)
    VALUES (uid, instance_uuid, 'authenticated', 'authenticated', 'super-admin@test.example.com', pwd_hash, now(), '', '', '{"name":"Test Super Admin"}'::jsonb, now(), now());
  END IF;
  UPDATE public.users SET organization_id = kre8ivtech_id, role = 'super_admin' WHERE email = 'super-admin@test.example.com';
  UPDATE public.profiles SET name = 'Test Super Admin' WHERE user_id = (SELECT id FROM public.users WHERE email = 'super-admin@test.example.com' LIMIT 1);

  -- staff
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@test.example.com') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, raw_user_meta_data, created_at, updated_at)
    VALUES (uid, instance_uuid, 'authenticated', 'authenticated', 'staff@test.example.com', pwd_hash, now(), '', '', '{"name":"Test Staff"}'::jsonb, now(), now());
  END IF;
  UPDATE public.users SET organization_id = kre8ivtech_id, role = 'staff' WHERE email = 'staff@test.example.com';
  UPDATE public.profiles SET name = 'Test Staff' WHERE user_id = (SELECT id FROM public.users WHERE email = 'staff@test.example.com' LIMIT 1);

  -- partner
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'partner@test.example.com') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, raw_user_meta_data, created_at, updated_at)
    VALUES (uid, instance_uuid, 'authenticated', 'authenticated', 'partner@test.example.com', pwd_hash, now(), '', '', '{"name":"Test Partner"}'::jsonb, now(), now());
  END IF;
  UPDATE public.users SET organization_id = partner_id, role = 'partner' WHERE email = 'partner@test.example.com';
  UPDATE public.profiles SET name = 'Test Partner' WHERE user_id = (SELECT id FROM public.users WHERE email = 'partner@test.example.com' LIMIT 1);

  -- partner_staff
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'partner-staff@test.example.com') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, raw_user_meta_data, created_at, updated_at)
    VALUES (uid, instance_uuid, 'authenticated', 'authenticated', 'partner-staff@test.example.com', pwd_hash, now(), '', '', '{"name":"Test Partner Staff"}'::jsonb, now(), now());
  END IF;
  UPDATE public.users SET organization_id = partner_id, role = 'partner_staff' WHERE email = 'partner-staff@test.example.com';
  UPDATE public.profiles SET name = 'Test Partner Staff' WHERE user_id = (SELECT id FROM public.users WHERE email = 'partner-staff@test.example.com' LIMIT 1);

  -- client
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'client@test.example.com') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, raw_user_meta_data, created_at, updated_at)
    VALUES (uid, instance_uuid, 'authenticated', 'authenticated', 'client@test.example.com', pwd_hash, now(), '', '', '{"name":"Test Client"}'::jsonb, now(), now());
  END IF;
  UPDATE public.users SET organization_id = client_id, role = 'client' WHERE email = 'client@test.example.com';
  UPDATE public.profiles SET name = 'Test Client' WHERE user_id = (SELECT id FROM public.users WHERE email = 'client@test.example.com' LIMIT 1);

END $$;

-- =============================================================================
-- 3. Summary
-- =============================================================================

SELECT u.email, u.role, o.slug AS org_slug, p.name
FROM public.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.organizations o ON o.id = u.organization_id
WHERE u.email IN (
  'super-admin@test.example.com',
  'staff@test.example.com',
  'partner@test.example.com',
  'partner-staff@test.example.com',
  'client@test.example.com'
)
ORDER BY u.email;
