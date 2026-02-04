-- Migration: Setup Kre8ivTech Main Organization
-- Description: Ensure Kre8ivTech organization exists and assign admin/staff users to it
-- Date: 2026-02-04

-- =============================================================================
-- 1. ENSURE KRE8IVTECH ORGANIZATION EXISTS
-- =============================================================================

-- Insert or update Kre8ivTech organization with proper settings
INSERT INTO organizations (
  name,
  slug,
  type,
  status,
  settings,
  branding_config
)
VALUES (
  'Kre8ivTech, LLC',
  'kre8ivtech',
  'kre8ivtech',
  'active',
  jsonb_build_object(
    'contact_email', 'info@kre8ivtech.com',
    'contact_phone', '',
    'timezone', 'America/New_York',
    'billing_address', jsonb_build_object(
      'street', '',
      'city', '',
      'state', '',
      'zip', '',
      'country', 'US'
    )
  ),
  jsonb_build_object(
    'logo_url', '',
    'primary_color', '#3b82f6'
  )
)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  updated_at = NOW();

-- =============================================================================
-- 2. ASSIGN ALL SUPER_ADMIN AND STAFF USERS TO KRE8IVTECH ORG
-- =============================================================================

-- Get the Kre8ivTech organization ID
DO $$
DECLARE
  kre8ivtech_org_id UUID;
BEGIN
  -- Get the Kre8ivTech organization ID
  SELECT id INTO kre8ivtech_org_id
  FROM organizations
  WHERE slug = 'kre8ivtech'
  LIMIT 1;

  -- Update all super_admin and staff users to belong to Kre8ivTech organization
  -- Only update if they don't already have an organization assigned
  UPDATE users
  SET
    organization_id = kre8ivtech_org_id,
    updated_at = NOW()
  WHERE role IN ('super_admin', 'staff')
    AND (organization_id IS NULL OR organization_id != kre8ivtech_org_id);

  -- Log the number of users updated
  RAISE NOTICE 'Updated % admin/staff users to Kre8ivTech organization',
    (SELECT COUNT(*) FROM users WHERE organization_id = kre8ivtech_org_id AND role IN ('super_admin', 'staff'));
END $$;

-- =============================================================================
-- 3. UPDATE HANDLE_NEW_USER FUNCTION TO AUTO-ASSIGN SUPER_ADMIN/STAFF
-- =============================================================================

-- Update the trigger function to automatically assign super_admin/staff to Kre8ivTech
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  kre8ivtech_org_id UUID;
  user_role VARCHAR(50);
BEGIN
  -- Check if raw_user_meta_data contains role information
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');

  -- Get Kre8ivTech organization ID if user is admin or staff
  IF user_role IN ('super_admin', 'staff') THEN
    SELECT id INTO kre8ivtech_org_id
    FROM organizations
    WHERE slug = 'kre8ivtech'
    LIMIT 1;
  END IF;

  -- Insert into users table with organization assignment for admin/staff
  INSERT INTO public.users (id, email, organization_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    kre8ivtech_org_id,  -- Will be NULL for non-admin/staff users
    user_role
  );

  -- Insert into profiles table
  INSERT INTO public.profiles (user_id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. ADD DESCRIPTION COLUMN TO ORGANIZATIONS (if not exists)
-- =============================================================================

-- Add description column to help identify the main organization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE organizations
    ADD COLUMN description TEXT;
  END IF;
END $$;

-- Update Kre8ivTech description
UPDATE organizations
SET description = 'Main organization - Kre8ivTech staff and admin belong here. Parent organization for white-label partners and direct clients.'
WHERE slug = 'kre8ivtech';

-- =============================================================================
-- 5. ADD HELPER FUNCTION TO GET KRE8IVTECH ORG ID
-- =============================================================================

CREATE OR REPLACE FUNCTION get_kre8ivtech_org_id()
RETURNS UUID AS $$
  SELECT id FROM organizations WHERE slug = 'kre8ivtech' LIMIT 1;
$$ LANGUAGE sql STABLE;

-- =============================================================================
-- VERIFICATION QUERIES (commented out, uncomment to run manually)
-- =============================================================================

-- Verify Kre8ivTech organization exists
-- SELECT * FROM organizations WHERE slug = 'kre8ivtech';

-- Verify admin/staff users are assigned to Kre8ivTech
-- SELECT u.id, u.email, u.role, u.organization_id, o.name as org_name
-- FROM users u
-- LEFT JOIN organizations o ON o.id = u.organization_id
-- WHERE u.role IN ('super_admin', 'staff');

-- View organization hierarchy
-- SELECT
--   o.name,
--   o.type,
--   o.slug,
--   parent.name as parent_name,
--   (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count
-- FROM organizations o
-- LEFT JOIN organizations parent ON parent.id = o.parent_org_id
-- ORDER BY o.type, o.name;
