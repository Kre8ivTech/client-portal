-- Migration: Allow super_admin to manage services across organizations
-- Description: Enables creating/editing/deleting services for any organization while
-- keeping staff scoped to their own organization_id.
-- Date: 2026-02-03

-- Super admins can manage all services across orgs
DROP POLICY IF EXISTS "Super admins can manage all services" ON public.services;
CREATE POLICY "Super admins can manage all services"
  ON public.services
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Staff can manage services in their own organization only
DROP POLICY IF EXISTS "Staff can manage services" ON public.services;
DROP POLICY IF EXISTS "Staff can manage org services" ON public.services;
CREATE POLICY "Staff can manage org services"
  ON public.services
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('staff')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('staff')
    )
  );

