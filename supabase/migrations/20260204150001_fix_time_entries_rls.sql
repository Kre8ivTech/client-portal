-- Migration: Fix time_entries RLS policies to use users table
-- Description: The original migration used profiles table but schema was restructured to use users

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view time entries in their org" ON time_entries;
DROP POLICY IF EXISTS "Staff can insert own time entries" ON time_entries;
DROP POLICY IF EXISTS "Staff can update time entries in their org" ON time_entries;
DROP POLICY IF EXISTS "Staff can delete own time entries" ON time_entries;

-- Recreate policies using users table
CREATE POLICY "Staff can view time entries in their org"
  ON time_entries FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Staff can insert own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'staff', 'partner', 'partner_staff')
      )
    )
  );

CREATE POLICY "Staff can update own time entries"
  ON time_entries FOR UPDATE
  USING (
    profile_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'staff', 'partner', 'partner_staff')
      )
    )
  );

CREATE POLICY "Staff can delete own time entries"
  ON time_entries FOR DELETE
  USING (
    profile_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'staff', 'partner', 'partner_staff')
      )
    )
  );

-- Super admin can view all time entries
DROP POLICY IF EXISTS "Super admin can view all time entries" ON time_entries;
CREATE POLICY "Super admin can view all time entries"
  ON time_entries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Clients can view time entries on their tickets (read-only)
DROP POLICY IF EXISTS "Clients can view time on their tickets" ON time_entries;
CREATE POLICY "Clients can view time on their tickets"
  ON time_entries FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM tickets 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );
