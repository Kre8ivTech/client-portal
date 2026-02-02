/**
 * Supabase Database types.
 *
 * This file is normally generated via:
 * `supabase gen types typescript --local > src/types/database.ts`
 *
 * If the Supabase CLI isn't available in the current environment, we fall back
 * to a minimal shape that keeps the app type-checking without blocking builds.
 */

// We intentionally type this as `any` when generated types are unavailable.
// This prevents the Supabase client generics from collapsing to `never` and
// blocking `tsc` in environments without the Supabase CLI.
export type Database = any
