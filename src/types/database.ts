export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_disputes: {
        Row: {
          created_at: string
          credit_amount: number | null
          credit_applied_to_invoice_id: string | null
          description: string
          dispute_type: Database["public"]["Enums"]["dispute_type"]
          id: string
          invoice_id: string | null
          organization_id: string
          plan_assignment_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          submitted_by: string
          supporting_documents: Json | null
          ticket_id: string | null
          time_entry_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_amount?: number | null
          credit_applied_to_invoice_id?: string | null
          description: string
          dispute_type: Database["public"]["Enums"]["dispute_type"]
          id?: string
          invoice_id?: string | null
          organization_id: string
          plan_assignment_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          submitted_by: string
          supporting_documents?: Json | null
          ticket_id?: string | null
          time_entry_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_amount?: number | null
          credit_applied_to_invoice_id?: string | null
          description?: string
          dispute_type?: Database["public"]["Enums"]["dispute_type"]
          id?: string
          invoice_id?: string | null
          organization_id?: string
          plan_assignment_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          submitted_by?: string
          supporting_documents?: Json | null
          ticket_id?: string | null
          time_entry_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_disputes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_disputes_plan_assignment_id_fkey"
            columns: ["plan_assignment_id"]
            isOneToOne: false
            referencedRelation: "plan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_disputes_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_disputes_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          sender_id: string | null
          sender_type: string
          session_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          sender_id?: string | null
          sender_type: string
          session_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          sender_id?: string | null
          sender_type?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          accepted_at: string | null
          agent_id: string | null
          converted_ticket_id: string | null
          created_at: string | null
          ended_at: string | null
          id: string
          organization_id: string
          pre_chat_data: Json | null
          queue_position: number | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          started_at: string | null
          status: string
          visitor_email: string | null
          visitor_id: string | null
          visitor_name: string | null
        }
        Insert: {
          accepted_at?: string | null
          agent_id?: string | null
          converted_ticket_id?: string | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          organization_id: string
          pre_chat_data?: Json | null
          queue_position?: number | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          started_at?: string | null
          status?: string
          visitor_email?: string | null
          visitor_id?: string | null
          visitor_name?: string | null
        }
        Update: {
          accepted_at?: string | null
          agent_id?: string | null
          converted_ticket_id?: string | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          organization_id?: string
          pre_chat_data?: Json | null
          queue_position?: number | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          started_at?: string | null
          status?: string
          visitor_email?: string | null
          visitor_id?: string | null
          visitor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_converted_ticket_id_fkey"
            columns: ["converted_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          organization_id: string
          participant_ids: string[]
          ticket_id: string | null
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          organization_id: string
          participant_ids?: string[]
          ticket_id?: string | null
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          organization_id?: string
          participant_ids?: string[]
          ticket_id?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          attachments: Json | null
          form_id: string
          id: string
          organization_id: string | null
          processed_at: string | null
          responses: Json
          status: string | null
          submitted_at: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          form_id: string
          id?: string
          organization_id?: string | null
          processed_at?: string | null
          responses?: Json
          status?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          form_id?: string
          id?: string
          organization_id?: string | null
          processed_at?: string | null
          responses?: Json
          status?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          fields: Json
          id: string
          name: string
          organization_id: string | null
          settings: Json | null
          slug: string
          status: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          fields?: Json
          id?: string
          name: string
          organization_id?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          fields?: Json
          id?: string
          name?: string
          organization_id?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          accent_color: string | null
          created_at: string
          description: string | null
          footer_text: string | null
          header_text: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          line_item_format: Json | null
          logo_url: string | null
          name: string
          organization_id: string | null
          primary_color: string | null
          show_hours_breakdown: boolean | null
          show_plan_summary: boolean | null
          show_rate_details: boolean | null
          terms_text: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          line_item_format?: Json | null
          logo_url?: string | null
          name: string
          organization_id?: string | null
          primary_color?: string | null
          show_hours_breakdown?: boolean | null
          show_plan_summary?: boolean | null
          show_rate_details?: boolean | null
          terms_text?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          line_item_format?: Json | null
          logo_url?: string | null
          name?: string
          organization_id?: string | null
          primary_color?: string | null
          show_hours_breakdown?: boolean | null
          show_plan_summary?: boolean | null
          show_rate_details?: boolean | null
          terms_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          access_level: string | null
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          featured_image: string | null
          helpful_count: number | null
          id: string
          meta_description: string | null
          meta_title: string | null
          not_helpful_count: number | null
          organization_id: string | null
          published_at: string | null
          slug: string
          status: string | null
          tags: Json | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          access_level?: string | null
          author_id?: string | null
          category_id?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          helpful_count?: number | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          not_helpful_count?: number | null
          organization_id?: string | null
          published_at?: string | null
          slug: string
          status?: string | null
          tags?: Json | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          access_level?: string | null
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          helpful_count?: number | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          not_helpful_count?: number | null
          organization_id?: string | null
          published_at?: string | null
          slug?: string
          status?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          access_level: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          access_level?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          access_level?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          message_type: string | null
          read_by: Json | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string | null
          read_by?: Json | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string | null
          read_by?: Json | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      office_hours: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          label: string | null
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          label?: string | null
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          label?: string | null
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_hours_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_hours_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding_config: Json | null
          created_at: string | null
          custom_domain: string | null
          custom_domain_verified: boolean | null
          custom_domain_verified_at: string | null
          id: string
          name: string
          parent_org_id: string | null
          settings: Json | null
          slug: string
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          branding_config?: Json | null
          created_at?: string | null
          custom_domain?: string | null
          custom_domain_verified?: boolean | null
          custom_domain_verified_at?: string | null
          id?: string
          name: string
          parent_org_id?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          branding_config?: Json | null
          created_at?: string | null
          custom_domain?: string | null
          custom_domain_verified?: boolean | null
          custom_domain_verified_at?: string | null
          id?: string
          name?: string
          parent_org_id?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      overage_acceptances: {
        Row: {
          accepted: boolean | null
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          description: string | null
          estimated_hours: number
          estimated_total: number
          hourly_rate: number
          id: string
          invoice_approved: boolean | null
          invoice_approved_at: string | null
          invoice_approved_by: string | null
          invoice_id: string | null
          overage_type: Database["public"]["Enums"]["coverage_type"]
          plan_assignment_id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          accepted?: boolean | null
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          description?: string | null
          estimated_hours: number
          estimated_total: number
          hourly_rate: number
          id?: string
          invoice_approved?: boolean | null
          invoice_approved_at?: string | null
          invoice_approved_by?: string | null
          invoice_id?: string | null
          overage_type: Database["public"]["Enums"]["coverage_type"]
          plan_assignment_id: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted?: boolean | null
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          description?: string | null
          estimated_hours?: number
          estimated_total?: number
          hourly_rate?: number
          id?: string
          invoice_approved?: boolean | null
          invoice_approved_at?: string | null
          invoice_approved_by?: string | null
          invoice_id?: string | null
          overage_type?: Database["public"]["Enums"]["coverage_type"]
          plan_assignment_id?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overage_acceptances_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overage_acceptances_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overage_acceptances_invoice_approved_by_fkey"
            columns: ["invoice_approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overage_acceptances_invoice_approved_by_fkey"
            columns: ["invoice_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overage_acceptances_plan_assignment_id_fkey"
            columns: ["plan_assignment_id"]
            isOneToOne: false
            referencedRelation: "plan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overage_acceptances_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overage_acceptances_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          created_at: string | null
          days: number
          description: string | null
          early_discount_days: number | null
          early_discount_percent: number | null
          grace_period_days: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          late_fee_amount: number | null
          late_fee_type: string | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days?: number
          description?: string | null
          early_discount_days?: number | null
          early_discount_percent?: number | null
          grace_period_days?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          late_fee_amount?: number | null
          late_fee_type?: string | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days?: number
          description?: string | null
          early_discount_days?: number | null
          early_discount_percent?: number | null
          grace_period_days?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          late_fee_amount?: number | null
          late_fee_type?: string | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_assignments: {
        Row: {
          auto_renew: boolean | null
          billing_cycle_day: number
          cancellation_reason: string | null
          cancellation_requested_at: string | null
          cancellation_requested_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          contract_id: string | null
          created_at: string
          dev_hours_used: number | null
          failed_payment_count: number | null
          grace_period_end: string | null
          grace_period_start: string | null
          id: string
          last_hours_reset_date: string | null
          last_payment_attempt: string | null
          next_billing_date: string
          organization_id: string
          partner_client_org_id: string | null
          plan_id: string
          proration_credit: number | null
          start_date: string
          status: Database["public"]["Enums"]["plan_status"]
          support_hours_used: number | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean | null
          billing_cycle_day: number
          cancellation_reason?: string | null
          cancellation_requested_at?: string | null
          cancellation_requested_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          contract_id?: string | null
          created_at?: string
          dev_hours_used?: number | null
          failed_payment_count?: number | null
          grace_period_end?: string | null
          grace_period_start?: string | null
          id?: string
          last_hours_reset_date?: string | null
          last_payment_attempt?: string | null
          next_billing_date: string
          organization_id: string
          partner_client_org_id?: string | null
          plan_id: string
          proration_credit?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["plan_status"]
          support_hours_used?: number | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean | null
          billing_cycle_day?: number
          cancellation_reason?: string | null
          cancellation_requested_at?: string | null
          cancellation_requested_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          contract_id?: string | null
          created_at?: string
          dev_hours_used?: number | null
          failed_payment_count?: number | null
          grace_period_end?: string | null
          grace_period_start?: string | null
          id?: string
          last_hours_reset_date?: string | null
          last_payment_attempt?: string | null
          next_billing_date?: string
          organization_id?: string
          partner_client_org_id?: string | null
          plan_id?: string
          proration_credit?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["plan_status"]
          support_hours_used?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_assignments_cancellation_requested_by_fkey"
            columns: ["cancellation_requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_cancellation_requested_by_fkey"
            columns: ["cancellation_requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_partner_client_org_id_fkey"
            columns: ["partner_client_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_coverage_items: {
        Row: {
          coverage_type: Database["public"]["Enums"]["coverage_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          coverage_type?: Database["public"]["Enums"]["coverage_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          coverage_type?: Database["public"]["Enums"]["coverage_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_coverage_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_hour_logs: {
        Row: {
          created_at: string
          dev_hours_used: number | null
          dev_overage_hours: number | null
          id: string
          is_current_period: boolean | null
          overage_invoice_id: string | null
          period_end: string
          period_start: string
          plan_assignment_id: string
          support_hours_used: number | null
          support_overage_hours: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dev_hours_used?: number | null
          dev_overage_hours?: number | null
          id?: string
          is_current_period?: boolean | null
          overage_invoice_id?: string | null
          period_end: string
          period_start: string
          plan_assignment_id: string
          support_hours_used?: number | null
          support_overage_hours?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dev_hours_used?: number | null
          dev_overage_hours?: number | null
          id?: string
          is_current_period?: boolean | null
          overage_invoice_id?: string | null
          period_end?: string
          period_start?: string
          plan_assignment_id?: string
          support_hours_used?: number | null
          support_overage_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_hour_logs_plan_assignment_id_fkey"
            columns: ["plan_assignment_id"]
            isOneToOne: false
            referencedRelation: "plan_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_renewal_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          days_before_renewal: number
          id: string
          plan_assignment_id: string
          scheduled_for: string
          sent_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          days_before_renewal: number
          id?: string
          plan_assignment_id: string
          scheduled_for: string
          sent_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          days_before_renewal?: number
          id?: string
          plan_assignment_id?: string
          scheduled_for?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_renewal_notifications_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_renewal_notifications_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_renewal_notifications_plan_assignment_id_fkey"
            columns: ["plan_assignment_id"]
            isOneToOne: false
            referencedRelation: "plan_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          auto_send_invoices: boolean | null
          created_at: string
          currency: string | null
          description: string | null
          dev_hourly_rate: number
          dev_hours_included: number
          id: string
          invoice_template_id: string | null
          is_active: boolean | null
          is_template: boolean | null
          monthly_fee: number
          name: string
          organization_id: string | null
          payment_terms_days: number | null
          rush_priority_boost: number | null
          rush_support_fee: number | null
          rush_support_included: boolean | null
          support_hourly_rate: number
          support_hours_included: number
          updated_at: string
        }
        Insert: {
          auto_send_invoices?: boolean | null
          created_at?: string
          currency?: string | null
          description?: string | null
          dev_hourly_rate?: number
          dev_hours_included?: number
          id?: string
          invoice_template_id?: string | null
          is_active?: boolean | null
          is_template?: boolean | null
          monthly_fee?: number
          name: string
          organization_id?: string | null
          payment_terms_days?: number | null
          rush_priority_boost?: number | null
          rush_support_fee?: number | null
          rush_support_included?: boolean | null
          support_hourly_rate?: number
          support_hours_included?: number
          updated_at?: string
        }
        Update: {
          auto_send_invoices?: boolean | null
          created_at?: string
          currency?: string | null
          description?: string | null
          dev_hourly_rate?: number
          dev_hours_included?: number
          id?: string
          invoice_template_id?: string | null
          is_active?: boolean | null
          is_template?: boolean | null
          monthly_fee?: number
          name?: string
          organization_id?: string | null
          payment_terms_days?: number | null
          rush_priority_boost?: number | null
          rush_support_fee?: number | null
          rush_support_included?: boolean | null
          support_hourly_rate?: number
          support_hours_included?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_invoice_template_id_fkey"
            columns: ["invoice_template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_branding: {
        Row: {
          app_name: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          app_name?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          app_name?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          last_seen_at: string | null
          name: string | null
          notification_preferences: Json | null
          presence_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          last_seen_at?: string | null
          name?: string | null
          notification_preferences?: Json | null
          presence_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          last_seen_at?: string | null
          name?: string | null
          notification_preferences?: Json | null
          presence_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_calendar_integrations: {
        Row: {
          calendar_name: string | null
          created_at: string | null
          external_calendar_id: string | null
          id: string
          last_sync_at: string | null
          provider: string
          sync_enabled: boolean | null
          sync_token: string | null
          timezone: string | null
          token_ref: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calendar_name?: string | null
          created_at?: string | null
          external_calendar_id?: string | null
          id?: string
          last_sync_at?: string | null
          provider: string
          sync_enabled?: boolean | null
          sync_token?: string | null
          timezone?: string | null
          token_ref?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calendar_name?: string | null
          created_at?: string | null
          external_calendar_id?: string | null
          id?: string
          last_sync_at?: string | null
          provider?: string
          sync_enabled?: boolean | null
          sync_token?: string | null
          timezone?: string | null
          token_ref?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_calendar_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_calendar_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          attachments: Json | null
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          ticket_id: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string | null
          created_by: string
          description: string
          first_response_at: string | null
          id: string
          organization_id: string
          parent_ticket_id: string | null
          priority: string
          resolved_at: string | null
          sla_due_at: string | null
          status: string
          subject: string
          tags: Json | null
          ticket_number: number
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          created_by: string
          description: string
          first_response_at?: string | null
          id?: string
          organization_id: string
          parent_ticket_id?: string | null
          priority?: string
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: string
          subject: string
          tags?: Json | null
          ticket_number?: number
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string
          description?: string
          first_response_at?: string | null
          id?: string
          organization_id?: string
          parent_ticket_id?: string | null
          priority?: string
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: string
          subject?: string
          tags?: Json | null
          ticket_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean | null
          created_at: string
          description: string
          entry_date: string
          hours: number
          id: string
          organization_id: string
          ticket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean | null
          created_at?: string
          description: string
          entry_date?: string
          hours: number
          id?: string
          organization_id: string
          ticket_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean | null
          created_at?: string
          description?: string
          entry_date?: string
          hours?: number
          id?: string
          organization_id?: string
          ticket_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          organization_id: string | null
          role: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          organization_id?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          organization_id?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_items: {
        Row: {
          auth_tag: string
          created_at: string | null
          created_by: string
          description: string | null
          encrypted_password: string
          id: string
          iv: string
          label: string
          organization_id: string
          service_url: string | null
          updated_at: string | null
          username: string | null
          version: number | null
        }
        Insert: {
          auth_tag: string
          created_at?: string | null
          created_by: string
          description?: string | null
          encrypted_password: string
          id?: string
          iv: string
          label: string
          organization_id: string
          service_url?: string | null
          updated_at?: string | null
          username?: string | null
          version?: number | null
        }
        Update: {
          auth_tag?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          encrypted_password?: string
          id?: string
          iv?: string
          label?: string
          organization_id?: string
          service_url?: string | null
          updated_at?: string | null
          username?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string | null
          last_seen_at: string | null
          name: string | null
          notification_preferences: Json | null
          organization_id: string | null
          organization_name: string | null
          organization_slug: string | null
          presence_status: string | null
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_organization_id: { Args: never; Returns: string }
      get_user_organization_type: { Args: never; Returns: string }
      is_admin_or_staff: { Args: never; Returns: boolean }
      is_kre8ivtech_user: { Args: never; Returns: boolean }
      is_partner_client: { Args: { client_org_id: string }; Returns: boolean }
      is_staff_or_super_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      coverage_type: "support" | "dev" | "both"
      dispute_status: "pending" | "under_review" | "resolved" | "rejected"
      dispute_type: "time_logged" | "invoice_amount" | "coverage" | "other"
      plan_status:
        | "pending"
        | "active"
        | "paused"
        | "grace_period"
        | "cancelled"
        | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      coverage_type: ["support", "dev", "both"],
      dispute_status: ["pending", "under_review", "resolved", "rejected"],
      dispute_type: ["time_logged", "invoice_amount", "coverage", "other"],
      plan_status: [
        "pending",
        "active",
        "paused",
        "grace_period",
        "cancelled",
        "expired",
      ],
    },
  },
} as const

