-- Migration: Add global visibility for services
-- Description: Allow admins to create services that are visible to all organizations,
-- not just their own organization or parent/child orgs.
-- Date: 2026-02-03

-- Add is_global column to services table
ALTER TABLE public.services 
ADD COLUMN is_global BOOLEAN DEFAULT false;

-- Update RLS policy to include global services
DROP POLICY IF EXISTS "Users can view active accessible services" ON public.services;

CREATE POLICY "Users can view active accessible services"
  ON public.services
  FOR SELECT
  USING (
    is_active = true
    AND (
      -- Global services are visible to everyone
      is_global = true
      OR
      -- Organization-specific services
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

-- Add comment
COMMENT ON COLUMN public.services.is_global IS 'When true, service is visible to all organizations regardless of organization_id';