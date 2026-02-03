-- Migration: Add organizations.description
-- Description: Fix tenant creation failing when inserting description
-- Date: 2026-02-04

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.organizations.description IS 'Optional description for the organization (tenant).';
