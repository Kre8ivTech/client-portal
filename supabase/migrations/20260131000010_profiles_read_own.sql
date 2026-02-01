-- Migration: Users can read their own profile
-- Description: Ensures every user can SELECT their own profile row (including role) for UI.
-- Required for "Profiles are viewable by organization members" subquery before 00020.
-- After 00020, profiles table is replaced; new profiles RLS includes user_id = auth.uid().
-- Date: 2026-01-31

CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());
