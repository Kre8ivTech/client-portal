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

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
