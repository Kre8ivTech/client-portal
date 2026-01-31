export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
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
      portal_branding: {
        Row: {
          id: string;
          app_name: string;
          tagline: string | null;
          logo_url: string | null;
          primary_color: string;
          favicon_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          app_name?: string;
          tagline?: string | null;
          logo_url?: string | null;
          primary_color?: string;
          favicon_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          app_name?: string;
          tagline?: string | null;
          logo_url?: string | null;
          primary_color?: string;
          favicon_url?: string | null;
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
          role: "super_admin" | "staff" | "partner" | "partner_staff" | "client";
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
          role?: "super_admin" | "staff" | "partner" | "partner_staff" | "client";
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
          role?: "super_admin" | "staff" | "partner" | "partner_staff" | "client";
          status?: "active" | "inactive" | "invited" | "suspended";
          presence_status?: "online" | "offline" | "away" | "dnd";
          last_seen_at?: string | null;
          notification_preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      staff_calendar_integrations: {
        Row: {
          id: string;
          profile_id: string;
          provider: "google" | "microsoft" | "outlook" | "ical";
          external_calendar_id: string | null;
          calendar_name: string | null;
          sync_enabled: boolean;
          last_sync_at: string | null;
          sync_token: string | null;
          timezone: string;
          token_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          provider: "google" | "microsoft" | "outlook" | "ical";
          external_calendar_id?: string | null;
          calendar_name?: string | null;
          sync_enabled?: boolean;
          last_sync_at?: string | null;
          sync_token?: string | null;
          timezone?: string;
          token_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          provider?: "google" | "microsoft" | "outlook" | "ical";
          external_calendar_id?: string | null;
          calendar_name?: string | null;
          sync_enabled?: boolean;
          last_sync_at?: string | null;
          sync_token?: string | null;
          timezone?: string;
          token_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      office_hours: {
        Row: {
          id: string;
          profile_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          label?: string | null;
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
          status: "pending" | "active" | "paused" | "grace_period" | "cancelled" | "expired";
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
          status?: "pending" | "active" | "paused" | "grace_period" | "cancelled" | "expired";
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
          status?: "pending" | "active" | "paused" | "grace_period" | "cancelled" | "expired";
          auto_renew?: boolean;
          support_hours_used?: number;
          dev_hours_used?: number;
          last_hours_reset_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          organization_id: string;
          ticket_number: number;
          subject: string;
          description: string;
          priority: "low" | "medium" | "high" | "critical";
          status: "new" | "open" | "in_progress" | "pending_client" | "resolved" | "closed";
          category: string | null;
          tags: Json;
          created_by: string;
          assigned_to: string | null;
          parent_ticket_id: string | null;
          sla_due_at: string | null;
          first_response_at: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          ticket_number?: number;
          subject: string;
          description: string;
          priority?: "low" | "medium" | "high" | "critical";
          status?: "new" | "open" | "in_progress" | "pending_client" | "resolved" | "closed";
          category?: string | null;
          tags?: Json;
          created_by: string;
          assigned_to?: string | null;
          parent_ticket_id?: string | null;
          sla_due_at?: string | null;
          first_response_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          ticket_number?: number;
          subject?: string;
          description?: string;
          priority?: "low" | "medium" | "high" | "critical";
          status?: "new" | "open" | "in_progress" | "pending_client" | "resolved" | "closed";
          category?: string | null;
          tags?: Json;
          created_by?: string;
          assigned_to?: string | null;
          parent_ticket_id?: string | null;
          sla_due_at?: string | null;
          first_response_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ticket_comments: {
        Row: {
          id: string;
          ticket_id: string;
          author_id: string;
          content: string;
          is_internal: boolean;
          attachments: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          author_id: string;
          content: string;
          is_internal?: boolean;
          attachments?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          author_id?: string;
          content?: string;
          is_internal?: boolean;
          attachments?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      vault_items: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          label: string;
          description: string | null;
          service_url: string | null;
          username: string | null;
          encrypted_password: string;
          iv: string;
          auth_tag: string;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          label: string;
          description?: string | null;
          service_url?: string | null;
          username?: string | null;
          encrypted_password: string;
          iv: string;
          auth_tag: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string;
          label?: string;
          description?: string | null;
          service_url?: string | null;
          username?: string | null;
          encrypted_password?: string;
          iv?: string;
          auth_tag?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          organization_id: string;
          type: "direct" | "group" | "support" | "project" | "internal";
          title: string | null;
          ticket_id: string | null;
          participant_ids: string[];
          last_message_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          type: "direct" | "group" | "support" | "project" | "internal";
          title?: string | null;
          ticket_id?: string | null;
          participant_ids?: string[];
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          type?: "direct" | "group" | "support" | "project" | "internal";
          title?: string | null;
          ticket_id?: string | null;
          participant_ids?: string[];
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          message_type: "text" | "file" | "system" | "action";
          attachments: Json;
          read_by: Json;
          edited_at: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          message_type?: "text" | "file" | "system" | "action";
          attachments?: Json;
          read_by?: Json;
          edited_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          message_type?: "text" | "file" | "system" | "action";
          attachments?: Json;
          read_by?: Json;
          edited_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          organization_id: string;
          visitor_id: string | null;
          visitor_name: string | null;
          visitor_email: string | null;
          agent_id: string | null;
          pre_chat_data: Json;
          status: "waiting" | "active" | "ended" | "missed";
          queue_position: number | null;
          started_at: string;
          accepted_at: string | null;
          ended_at: string | null;
          satisfaction_rating: number | null;
          satisfaction_comment: string | null;
          converted_ticket_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          visitor_id?: string | null;
          visitor_name?: string | null;
          visitor_email?: string | null;
          agent_id?: string | null;
          pre_chat_data?: Json;
          status?: "waiting" | "active" | "ended" | "missed";
          queue_position?: number | null;
          started_at?: string;
          accepted_at?: string | null;
          ended_at?: string | null;
          satisfaction_rating?: number | null;
          satisfaction_comment?: string | null;
          converted_ticket_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          visitor_id?: string | null;
          visitor_name?: string | null;
          visitor_email?: string | null;
          agent_id?: string | null;
          pre_chat_data?: Json;
          status?: "waiting" | "active" | "ended" | "missed";
          queue_position?: number | null;
          started_at?: string;
          accepted_at?: string | null;
          ended_at?: string | null;
          satisfaction_rating?: number | null;
          satisfaction_comment?: string | null;
          converted_ticket_id?: string | null;
          created_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          sender_type: "visitor" | "agent" | "system" | "bot";
          sender_id: string | null;
          content: string;
          is_internal: boolean;
          attachments: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          sender_type: "visitor" | "agent" | "system" | "bot";
          sender_id?: string | null;
          content: string;
          is_internal?: boolean;
          attachments?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          sender_type?: "visitor" | "agent" | "system" | "bot";
          sender_id?: string | null;
          content?: string;
          is_internal?: boolean;
          attachments?: Json;
          created_at?: string;
        };
      };
      kb_categories: {
        Row: {
          id: string;
          organization_id: string | null;
          parent_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          access_level: "public" | "partner" | "internal" | "client_specific";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          parent_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          access_level?: "public" | "partner" | "internal" | "client_specific";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          parent_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          access_level?: "public" | "partner" | "internal" | "client_specific";
          created_at?: string;
          updated_at?: string;
        };
      };
      kb_articles: {
        Row: {
          id: string;
          organization_id: string | null;
          category_id: string | null;
          title: string;
          slug: string;
          content: string;
          excerpt: string | null;
          featured_image: string | null;
          status: "draft" | "published" | "archived";
          access_level: "public" | "partner" | "internal" | "client_specific";
          tags: Json;
          author_id: string | null;
          published_at: string | null;
          view_count: number;
          helpful_count: number;
          not_helpful_count: number;
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          category_id?: string | null;
          title: string;
          slug: string;
          content: string;
          excerpt?: string | null;
          featured_image?: string | null;
          status?: "draft" | "published" | "archived";
          access_level?: "public" | "partner" | "internal" | "client_specific";
          tags?: Json;
          author_id?: string | null;
          published_at?: string | null;
          view_count?: number;
          helpful_count?: number;
          not_helpful_count?: number;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          category_id?: string | null;
          title?: string;
          slug?: string;
          content?: string;
          excerpt?: string | null;
          featured_image?: string | null;
          status?: "draft" | "published" | "archived";
          access_level?: "public" | "partner" | "internal" | "client_specific";
          tags?: Json;
          author_id?: string | null;
          published_at?: string | null;
          view_count?: number;
          helpful_count?: number;
          not_helpful_count?: number;
          meta_title?: string | null;
          meta_description?: string | null;
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
      plan_status: "pending" | "active" | "paused" | "grace_period" | "cancelled" | "expired";
      coverage_type: "support" | "dev" | "both";
      dispute_status: "pending" | "under_review" | "resolved" | "rejected";
      dispute_type: "time_logged" | "invoice_amount" | "coverage" | "other";
    };
  };
};
