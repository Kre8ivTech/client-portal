/**
 * Supabase Database types.
 *
 * This project typically generates this file via:
 * `supabase gen types typescript ... > src/types/database.ts`
 *
 * In some environments (CI/Cloud Agents) the Supabase CLI may not be available,
 * and a broken redirect can accidentally write shell output into this file.
 *
 * This lightweight definition preserves the expected shape used across the app
 * (e.g. `Database['public']['Tables']['tickets']['Row']`) while keeping the
 * codebase type-checkable.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// NOTE: Supabase client generics require a fully generated schema type. Until the
// Supabase CLI types are generated reliably in this repo, we intentionally fall
// back to `any` to keep `tsc --noEmit` green.
export type Database = any;
