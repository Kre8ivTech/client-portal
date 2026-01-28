export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          type: "kre8ivtech" | "partner" | "client";
          parent_org_id: string | null;
          status: "active" | "inactive" | "suspended";
          branding_config: Json;
          custom_domain: string | null;
          custom_domain_verified: boolean;
          custom_domain_verified_at: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          type: "kre8ivtech" | "partner" | "client";
          parent_org_id?: string | null;
          status?: "active" | "inactive" | "suspended";
          branding_config?: Json;
          custom_domain?: string | null;
          custom_domain_verified?: boolean;
          custom_domain_verified_at?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          type?: "kre8ivtech" | "partner" | "client";
          parent_org_id?: string | null;
          status?: "active" | "inactive" | "suspended";
          branding_config?: Json;
          custom_domain?: string | null;
          custom_domain_verified?: boolean;
          custom_domain_verified_at?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          email: string;
          name: string | null;
          avatar_url: string | null;
          role:
            | "super_admin"
            | "staff"
            | "partner"
            | "partner_staff"
            | "client";
          status: "active" | "inactive" | "invited" | "suspended";
          presence_status: "online" | "offline" | "away" | "dnd";
          last_seen_at: string | null;
          notification_preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          role?:
            | "super_admin"
            | "staff"
            | "partner"
            | "partner_staff"
            | "client";
          status?: "active" | "inactive" | "invited" | "suspended";
          presence_status?: "online" | "offline" | "away" | "dnd";
          last_seen_at?: string | null;
          notification_preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          role?:
            | "super_admin"
            | "staff"
            | "partner"
            | "partner_staff"
            | "client";
          status?: "active" | "inactive" | "invited" | "suspended";
          presence_status?: "online" | "offline" | "away" | "dnd";
          last_seen_at?: string | null;
          notification_preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          description: string | null;
          support_hours_included: number;
          dev_hours_included: number;
          support_hourly_rate: number;
          dev_hourly_rate: number;
          monthly_fee: number;
          currency: string;
          payment_terms_days: number;
          auto_send_invoices: boolean;
          invoice_template_id: string | null;
          rush_support_included: boolean;
          rush_support_fee: number;
          rush_priority_boost: number;
          is_template: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          name: string;
          description?: string | null;
          support_hours_included?: number;
          dev_hours_included?: number;
          support_hourly_rate?: number;
          dev_hourly_rate?: number;
          monthly_fee?: number;
          currency?: string;
          payment_terms_days?: number;
          auto_send_invoices?: boolean;
          invoice_template_id?: string | null;
          rush_support_included?: boolean;
          rush_support_fee?: number;
          rush_priority_boost?: number;
          is_template?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          description?: string | null;
          support_hours_included?: number;
          dev_hours_included?: number;
          support_hourly_rate?: number;
          dev_hourly_rate?: number;
          monthly_fee?: number;
          currency?: string;
          payment_terms_days?: number;
          auto_send_invoices?: boolean;
          invoice_template_id?: string | null;
          rush_support_included?: boolean;
          rush_support_fee?: number;
          rush_priority_boost?: number;
          is_template?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      plan_assignments: {
        Row: {
          id: string;
          plan_id: string;
          organization_id: string;
          partner_client_org_id: string | null;
          start_date: string;
          next_billing_date: string;
          billing_cycle_day: number;
          status:
            | "pending"
            | "active"
            | "paused"
            | "grace_period"
            | "cancelled"
            | "expired";
          auto_renew: boolean;
          support_hours_used: number;
          dev_hours_used: number;
          last_hours_reset_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          organization_id: string;
          partner_client_org_id?: string | null;
          start_date: string;
          next_billing_date: string;
          billing_cycle_day: number;
          status?:
            | "pending"
            | "active"
            | "paused"
            | "grace_period"
            | "cancelled"
            | "expired";
          auto_renew?: boolean;
          support_hours_used?: number;
          dev_hours_used?: number;
          last_hours_reset_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          organization_id?: string;
          partner_client_org_id?: string | null;
          start_date?: string;
          next_billing_date?: string;
          billing_cycle_day?: number;
          status?:
            | "pending"
            | "active"
            | "paused"
            | "grace_period"
            | "cancelled"
            | "expired";
          auto_renew?: boolean;
          support_hours_used?: number;
          dev_hours_used?: number;
          last_hours_reset_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      plan_status:
        | "pending"
        | "active"
        | "paused"
        | "grace_period"
        | "cancelled"
        | "expired";
      coverage_type: "support" | "dev" | "both";
      dispute_status: "pending" | "under_review" | "resolved" | "rejected";
      dispute_type: "time_logged" | "invoice_amount" | "coverage" | "other";
    };
  };
}
