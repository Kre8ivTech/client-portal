-- Migration: Fix services RLS to properly show global services to all users
-- Description: Consolidates the services RLS policies to ensure global services
-- are visible to all authenticated users regardless of organization.
-- Date: 2026-02-04

-- Drop all existing SELECT policies for services to avoid conflicts
DROP POLICY IF EXISTS "Users can view active org services" ON public.services;
DROP POLICY IF EXISTS "Users can view active accessible services" ON public.services;
DROP POLICY IF EXISTS "Staff can view all org services" ON public.services;
DROP POLICY IF EXISTS "Clients can view active services" ON public.services;

-- Create a single unified SELECT policy that includes:
-- 1. Global services (is_global = true) visible to all authenticated users
-- 2. Organization-specific services for users in that org
-- 3. Parent organization services for white-label clients
CREATE POLICY "Users can view accessible services"
  ON public.services
  FOR SELECT
  USING (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    AND (
      -- Global services are visible to everyone
      (is_active = true AND is_global = true)
      OR
      -- Active services in user's own organization
      (is_active = true AND organization_id = (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      ))
      OR
      -- Services from parent organization (for white-label clients)
      (is_active = true AND organization_id = (
        SELECT parent_org_id
        FROM public.organizations
        WHERE id = (
          SELECT organization_id
          FROM public.users
          WHERE id = auth.uid()
        )
      ))
      OR
      -- Staff/Admin can see ALL services in their org (including inactive)
      (organization_id = (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff', 'partner')
      ))
    )
  );

-- Super admins can see ALL services across all orgs (for admin panel)
DROP POLICY IF EXISTS "Super admins can view all services" ON public.services;
CREATE POLICY "Super admins can view all services"
  ON public.services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Add index on is_global for performance
CREATE INDEX IF NOT EXISTS idx_services_is_global ON public.services(is_global) WHERE is_global = true;

COMMENT ON POLICY "Users can view accessible services" ON public.services IS 
  'Allows viewing: global services (all users), org services (own org), parent org services (white-label), all org services (staff/admin)';
