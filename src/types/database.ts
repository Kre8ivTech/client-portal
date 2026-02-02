/**
 * Minimal Supabase `Database` type placeholder.
 *
 * This repository normally generates a full schema type via:
 * `supabase gen types typescript --local > src/types/database.ts`
 *
 * In environments where the Supabase CLI isn't available, we keep a safe
 * catch-all type so builds and type-checking can proceed.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: any[];
      }
    >;
    Views: Record<
      string,
      {
        Row: Record<string, any>;
        Relationships: any[];
      }
    >;
    Functions: Record<
      string,
      {
        Args: Record<string, any>;
        Returns: any;
      }
    >;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, any>;
  };
};

