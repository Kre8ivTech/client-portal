-- Migration: Fix conflicting RLS policies for services table
-- Description: Consolidates multiple conflicting policies into a single unified policy
-- that properly handles global services visibility for all clients.
-- Issue: Previous migrations created multiple policies without properly dropping old ones,
-- causing conflicts in service visibility.
-- Date: 2026-02-11

-- Drop ALL existing SELECT policies to start clean
DROP POLICY IF EXISTS "Users can view active accessible services" ON public.services;
DROP POLICY IF EXISTS "Users can view accessible services" ON public.services;
DROP POLICY IF EXISTS "Users can view services" ON public.services;
DROP POLICY IF EXISTS "Users can view services in their organization" ON public.services;
DROP POLICY IF EXISTS "Users can view org services" ON public.services;
DROP POLICY IF EXISTS "Users can view available services" ON public.services;
DROP POLICY IF EXISTS "Clients can view active services" ON public.services;
DROP POLICY IF EXISTS "Staff can view all org services" ON public.services;
DROP POLICY IF EXISTS "Super admins can view all services" ON public.services;

-- Create a single unified SELECT policy that handles all cases:
-- 1. Global services (is_global = true) - visible to ALL authenticated users
-- 2. Active organization-specific services - visible to org members
-- 3. Active parent org services - visible to white-label child org members
-- 4. Staff/Admin can see ALL services (including inactive) in their org
-- 5. Super admins can see ALL services across ALL organizations
CREATE POLICY "Users can view services"
  ON public.services
  FOR SELECT
  USING (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    AND (
      -- Case 1: Global services that are active - visible to everyone
      (is_global = true AND is_active = true)
      OR
      -- Case 2: Active services in user's own organization
      (is_active = true AND organization_id = (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      ))
      OR
      -- Case 3: Active services from parent organization (for white-label clients)
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
      -- Case 4: Staff/Admin/Partner can see ALL services in their org (including inactive)
      (organization_id = (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
          AND role IN ('super_admin', 'staff', 'partner')
      ))
      OR
      -- Case 5: Super admins can see ALL services across all organizations
      EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = auth.uid()
          AND role = 'super_admin'
      )
    )
  );

-- Add index for performance on global service queries
CREATE INDEX IF NOT EXISTS idx_services_is_global ON public.services(is_global) WHERE is_global = true;

-- Add index for active services queries  
CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services(is_active) WHERE is_active = true;

-- Add helpful comment
COMMENT ON POLICY "Users can view services" ON public.services IS 
  'Unified policy: global services (all users), active org services (members), active parent services (white-label), all org services (staff/admin), all services (super admin)';
