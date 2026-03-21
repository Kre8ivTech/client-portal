-- Defensive SELECT on organizations for internal roles.
-- Uses an EXISTS on public.users scoped to auth.uid() so RLS on users allows the row (own row)
-- without relying on is_super_admin() or SECURITY DEFINER helpers (avoids drift / recursion issues).

DROP POLICY IF EXISTS "Staff and super admin read all organizations" ON public.organizations;

CREATE POLICY "Staff and super admin read all organizations"
  ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'staff')
    )
  );
