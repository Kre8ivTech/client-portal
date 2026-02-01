-- Allow authenticated users to create their own users + profiles row if missing
-- (e.g. trigger failed, or user created before restructure). Dashboard layout backfills on first load.

CREATE POLICY "Users can insert own user row"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());
