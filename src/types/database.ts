/**
 * Database types for KT-Portal
 *
 * NOTE: This file should be regenerated after schema changes using:
 * supabase gen types typescript --local > src/types/database.ts
 *
 * These are placeholder types. The actual application uses 'as any' casts
 * in many places due to the dynamic nature of the Supabase client.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// This repo currently treats Supabase data as dynamic in many places.
// Keeping Database as `any` avoids widespread `never/unknown` inference issues
// until the schema types are properly generated in CI/local dev.
export type Database = any
