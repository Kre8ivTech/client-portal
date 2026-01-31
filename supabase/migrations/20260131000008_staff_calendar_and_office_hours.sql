-- Migration: Staff calendar integrations and office hours
-- Description: Enables staff/admin to connect calendars and set office hours for capacity analysis
-- Date: 2026-01-31

-- =============================================================================
-- STAFF CALENDAR INTEGRATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Provider: google, microsoft, outlook, etc.
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'microsoft', 'outlook', 'ical')),

  -- External calendar identifier (e.g. calendar ID from provider)
  external_calendar_id VARCHAR(500),
  calendar_name VARCHAR(255),

  -- Sync state
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_token TEXT,

  -- Timezone for availability display
  timezone VARCHAR(100) DEFAULT 'UTC',

  -- OAuth / token reference: store only non-sensitive metadata; tokens in vault or server env
  token_ref VARCHAR(500),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (profile_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_staff_calendar_integrations_profile ON staff_calendar_integrations(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_calendar_integrations_provider ON staff_calendar_integrations(provider);

CREATE TRIGGER update_staff_calendar_integrations_updated_at
  BEFORE UPDATE ON staff_calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- OFFICE HOURS (recurring weekly availability)
-- =============================================================================

CREATE TABLE IF NOT EXISTS office_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Day of week: 0 = Sunday, 1 = Monday, ... 6 = Saturday
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Local time slots (stored as TIME without timezone; interpret in profile timezone)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),

  -- Optional label (e.g. "Morning shift", "Remote")
  label VARCHAR(100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (profile_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_office_hours_profile ON office_hours(profile_id);
CREATE INDEX IF NOT EXISTS idx_office_hours_day ON office_hours(profile_id, day_of_week);

CREATE TRIGGER update_office_hours_updated_at
  BEFORE UPDATE ON office_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- RLS: Staff/Admin only, own rows
-- =============================================================================

ALTER TABLE staff_calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_hours ENABLE ROW LEVEL SECURITY;

-- Helper: current user is staff or super_admin
CREATE OR REPLACE FUNCTION is_staff_or_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('staff', 'super_admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Calendar integrations: staff/super_admin can CRUD own only
CREATE POLICY "Staff can view own calendar integrations"
  ON staff_calendar_integrations FOR SELECT
  USING (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  );

CREATE POLICY "Staff can insert own calendar integration"
  ON staff_calendar_integrations FOR INSERT
  WITH CHECK (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  );

CREATE POLICY "Staff can update own calendar integration"
  ON staff_calendar_integrations FOR UPDATE
  USING (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  )
  WITH CHECK (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  );

CREATE POLICY "Staff can delete own calendar integration"
  ON staff_calendar_integrations FOR DELETE
  USING (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  );

-- Super admin can view all calendar integrations (for capacity/team view)
CREATE POLICY "Super admin can view all calendar integrations"
  ON staff_calendar_integrations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Office hours: staff/super_admin can CRUD own only
CREATE POLICY "Staff can view own office hours"
  ON office_hours FOR SELECT
  USING (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  );

CREATE POLICY "Staff can insert own office hours"
  ON office_hours FOR INSERT
  WITH CHECK (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  );

CREATE POLICY "Staff can update own office hours"
  ON office_hours FOR UPDATE
  USING (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  )
  WITH CHECK (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  );

CREATE POLICY "Staff can delete own office hours"
  ON office_hours FOR DELETE
  USING (
    is_staff_or_super_admin() AND profile_id = auth.uid()
  );

-- Super admin can view all office hours (for capacity analysis)
CREATE POLICY "Super admin can view all office hours"
  ON office_hours FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMENT ON TABLE staff_calendar_integrations IS 'Calendar integrations for staff/admin; used for capacity and availability analysis';
COMMENT ON TABLE office_hours IS 'Recurring weekly office hours per staff/admin for capacity analysis';
