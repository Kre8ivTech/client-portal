-- Fix calendar integrations and office hours to use users table after schema restructure
-- Date: 2026-02-01

-- =============================================================================
-- 1. Update staff_calendar_integrations table
-- =============================================================================

-- Drop existing foreign key constraint
ALTER TABLE staff_calendar_integrations 
  DROP CONSTRAINT IF EXISTS staff_calendar_integrations_profile_id_fkey;

-- Rename profile_id to user_id
ALTER TABLE staff_calendar_integrations 
  RENAME COLUMN profile_id TO user_id;

-- Add new foreign key to users table
ALTER TABLE staff_calendar_integrations 
  ADD CONSTRAINT staff_calendar_integrations_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_staff_calendar_integrations_profile;
CREATE INDEX IF NOT EXISTS idx_staff_calendar_integrations_user 
  ON staff_calendar_integrations(user_id);

-- Update unique constraint
ALTER TABLE staff_calendar_integrations 
  DROP CONSTRAINT IF EXISTS staff_calendar_integrations_profile_id_provider_key;
ALTER TABLE staff_calendar_integrations 
  ADD CONSTRAINT staff_calendar_integrations_user_id_provider_key 
  UNIQUE (user_id, provider);

-- =============================================================================
-- 2. Update office_hours table
-- =============================================================================

-- Drop existing foreign key constraint
ALTER TABLE office_hours 
  DROP CONSTRAINT IF EXISTS office_hours_profile_id_fkey;

-- Rename profile_id to user_id
ALTER TABLE office_hours 
  RENAME COLUMN profile_id TO user_id;

-- Add new foreign key to users table
ALTER TABLE office_hours 
  ADD CONSTRAINT office_hours_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_office_hours_profile;
DROP INDEX IF EXISTS idx_office_hours_day;
CREATE INDEX IF NOT EXISTS idx_office_hours_user 
  ON office_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_office_hours_user_day 
  ON office_hours(user_id, day_of_week);

-- Update unique constraint
ALTER TABLE office_hours 
  DROP CONSTRAINT IF EXISTS office_hours_profile_id_day_of_week_start_time_key;
ALTER TABLE office_hours 
  ADD CONSTRAINT office_hours_user_id_day_of_week_start_time_key 
  UNIQUE (user_id, day_of_week, start_time);

-- =============================================================================
-- 3. Update RLS helper function to use users table
-- =============================================================================

CREATE OR REPLACE FUNCTION is_staff_or_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('staff', 'super_admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- 4. Recreate RLS policies with user_id
-- =============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Staff can view own calendar integrations" ON staff_calendar_integrations;
DROP POLICY IF EXISTS "Staff can insert own calendar integration" ON staff_calendar_integrations;
DROP POLICY IF EXISTS "Staff can update own calendar integration" ON staff_calendar_integrations;
DROP POLICY IF EXISTS "Staff can delete own calendar integration" ON staff_calendar_integrations;
DROP POLICY IF EXISTS "Super admin can view all calendar integrations" ON staff_calendar_integrations;

DROP POLICY IF EXISTS "Staff can view own office hours" ON office_hours;
DROP POLICY IF EXISTS "Staff can insert own office hours" ON office_hours;
DROP POLICY IF EXISTS "Staff can update own office hours" ON office_hours;
DROP POLICY IF EXISTS "Staff can delete own office hours" ON office_hours;
DROP POLICY IF EXISTS "Super admin can view all office hours" ON office_hours;

-- Calendar integrations: staff/super_admin can CRUD own only
CREATE POLICY "Staff can view own calendar integrations"
  ON staff_calendar_integrations FOR SELECT
  USING (
    is_staff_or_super_admin() AND user_id = auth.uid()
  );

CREATE POLICY "Staff can insert own calendar integration"
  ON staff_calendar_integrations FOR INSERT
  WITH CHECK (
    is_staff_or_super_admin() AND user_id = auth.uid()
  );

CREATE POLICY "Staff can update own calendar integration"
  ON staff_calendar_integrations FOR UPDATE
  USING (
    is_staff_or_super_admin() AND user_id = auth.uid()
  )
  WITH CHECK (
    is_staff_or_super_admin() AND user_id = auth.uid()
  );

CREATE POLICY "Staff can delete own calendar integration"
  ON staff_calendar_integrations FOR DELETE
  USING (
    is_staff_or_super_admin() AND user_id = auth.uid()
  );

-- Super admin can view all calendar integrations (for capacity/team view)
CREATE POLICY "Super admin can view all calendar integrations"
  ON staff_calendar_integrations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Office hours: staff/super_admin can CRUD own only
CREATE POLICY "Staff can view own office hours"
  ON office_hours FOR SELECT
  USING (
    is_staff_or_super_admin() AND user_id = auth.uid()
  );

CREATE POLICY "Staff can insert own office hours"
  ON office_hours FOR INSERT
  WITH CHECK (
    is_staff_or_super_admin() AND user_id = auth.uid()
  );

CREATE POLICY "Staff can update own office hours"
  ON office_hours FOR UPDATE
  USING (
    is_staff_or_super_admin() AND user_id = auth.uid()
  )
  WITH CHECK (
    is_staff_or_super_admin() AND user_id = auth.uid()
  );

CREATE POLICY "Staff can delete own office hours"
  ON office_hours FOR DELETE
  USING (
    is_staff_or_super_admin() AND user_id = auth.uid()
  );

-- Super admin can view all office hours (for capacity analysis)
CREATE POLICY "Super admin can view all office hours"
  ON office_hours FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Update comments
COMMENT ON TABLE staff_calendar_integrations IS 'Calendar integrations for staff/admin; used for capacity and availability analysis. References users table.';
COMMENT ON TABLE office_hours IS 'Recurring weekly office hours per staff/admin for capacity analysis. References users table.';
