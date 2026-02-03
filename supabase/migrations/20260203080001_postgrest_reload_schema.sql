-- Migration: Reload PostgREST schema cache
-- Description: Ensures PostgREST/Supabase schema cache is refreshed after DDL changes.
-- Date: 2026-02-03

NOTIFY pgrst, 'reload schema';

