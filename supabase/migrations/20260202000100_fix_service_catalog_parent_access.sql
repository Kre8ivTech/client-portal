-- Migration: Fix service catalog access for child orgs
-- Description: Allow users to view active services offered by their org OR their parent org.
-- This enables client orgs to request services provided by their partner/parent org.
-- Date: 2026-02-02

-- SERVICES: allow active services from org or parent org
DROP POLICY IF EXISTS "Users can view active org services" ON public.services;

CREATE POLICY "Users can view active accessible services"
  ON public.services
  FOR SELECT
  USING (
    is_active = true
    AND (
      organization_id = (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
      )
      OR organization_id = (
        SELECT parent_org_id
        FROM public.organizations
        WHERE id = (
          SELECT organization_id
          FROM public.users
          WHERE id = auth.uid()
        )
      )
    )
  );
