-- Migration: Users can read their own profile
-- Description: Ensures every user can SELECT their own profile row (including role) for UI
-- Date: 2026-01-31

CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());
