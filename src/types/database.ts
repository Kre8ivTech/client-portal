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
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          type: 'kre8ivtech' | 'partner' | 'client'
          parent_org_id: string | null
          status: 'active' | 'inactive' | 'suspended'
          branding_config: Json
          custom_domain: string | null
          custom_domain_verified: boolean
          custom_domain_verified_at: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          type: 'kre8ivtech' | 'partner' | 'client'
          parent_org_id?: string | null
          status?: 'active' | 'inactive' | 'suspended'
          branding_config?: Json
          custom_domain?: string | null
          custom_domain_verified?: boolean
          custom_domain_verified_at?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          type?: 'kre8ivtech' | 'partner' | 'client'
          parent_org_id?: string | null
          status?: 'active' | 'inactive' | 'suspended'
          branding_config?: Json
          custom_domain?: string | null
          custom_domain_verified?: boolean
          custom_domain_verified_at?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          email: string
          name: string | null
          avatar_url: string | null
          role: 'super_admin' | 'staff' | 'partner' | 'partner_staff' | 'client'
          status: 'active' | 'inactive' | 'invited' | 'suspended'
          presence_status: 'online' | 'offline' | 'away' | 'dnd'
          last_seen_at: string | null
          notification_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          email: string
          name?: string | null
          avatar_url?: string | null
          role?: 'super_admin' | 'staff' | 'partner' | 'partner_staff' | 'client'
          status?: 'active' | 'inactive' | 'invited' | 'suspended'
          presence_status?: 'online' | 'offline' | 'away' | 'dnd'
          last_seen_at?: string | null
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          email?: string
          name?: string | null
          avatar_url?: string | null
          role?: 'super_admin' | 'staff' | 'partner' | 'partner_staff' | 'client'
          status?: 'active' | 'inactive' | 'invited' | 'suspended'
          presence_status?: 'online' | 'offline' | 'away' | 'dnd'
          last_seen_at?: string | null
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
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
