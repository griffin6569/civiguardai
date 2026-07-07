export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          message: string
          severity: string
          title: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          message: string
          severity: string
          title: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          message?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "infrastructure_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_log: {
        Row: {
          asset_id: string
          cost: number | null
          created_at: string
          description: string | null
          id: string
          next_scheduled: string | null
          performed_at: string | null
          performed_by: string | null
          type: string
        }
        Insert: {
          asset_id: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          next_scheduled?: string | null
          performed_at?: string | null
          performed_by?: string | null
          type?: string
        }
        Update: {
          asset_id?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          next_scheduled?: string | null
          performed_at?: string | null
          performed_by?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "infrastructure_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      external_data_sources: {
        Row: {
          auth_type: string
          created_at: string
          endpoint_url: string | null
          id: string
          is_active: boolean
          last_synced: string | null
          name: string
          records_count: number | null
          sync_interval_minutes: number | null
          type: string
          updated_at: string
        }
        Insert: {
          auth_type?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          last_synced?: string | null
          name: string
          records_count?: number | null
          sync_interval_minutes?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          auth_type?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          last_synced?: string | null
          name?: string
          records_count?: number | null
          sync_interval_minutes?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          records_created: number | null
          records_processed: number | null
          records_updated: number | null
          source_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          source_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          source_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_sync_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "external_data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_assets: {
        Row: {
          created_at: string
          data_confidence: number | null
          external_id: string | null
          health_score: number
          id: string
          last_inspection: string | null
          latitude: number
          longitude: number
          name: string
          source_last_updated: string | null
          source_system: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_confidence?: number | null
          external_id?: string | null
          health_score?: number
          id?: string
          last_inspection?: string | null
          latitude: number
          longitude: number
          name: string
          source_last_updated?: string | null
          source_system?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_confidence?: number | null
          external_id?: string | null
          health_score?: number
          id?: string
          last_inspection?: string | null
          latitude?: number
          longitude?: number
          name?: string
          source_last_updated?: string | null
          source_system?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          category: string | null
          channel: string
          county: string | null
          created_at: string
          id: string
          is_active: boolean | null
          severity_threshold: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          channel?: string
          county?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          severity_threshold?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          channel?: string
          county?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          severity_threshold?: string | null
          user_id?: string
        }
        Relationships: []
      }
      offline_sync_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          retry_count: number | null
          status: string
          synced_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload: Json
          retry_count?: number | null
          status?: string
          synced_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          retry_count?: number | null
          status?: string
          synced_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      repair_evidence: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          notes: string | null
          phase: string
          report_id: string
          type: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          phase?: string
          report_id: string
          type?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          phase?: string
          report_id?: string
          type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_evidence_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          report_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          report_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          address: string | null
          ai_analysis: Json | null
          ai_confidence: number | null
          asset_id: string | null
          assigned_agency: string | null
          assigned_to: string | null
          citizen_confirmed_at: string | null
          created_at: string
          damage_type: string
          description: string
          duplicate_of: string | null
          estimated_completion: string | null
          estimated_cost: number | null
          fraud_flag: boolean | null
          id: string
          image_url: string | null
          impact_score: number | null
          inspection_notes: string | null
          latitude: number
          longitude: number
          needs_human_review: boolean | null
          organization_id: string | null
          people_affected: number | null
          priority_score: number | null
          reporter_email: string | null
          reporter_name: string | null
          resolved_at: string | null
          safety_risk: string | null
          severity: string | null
          spam_flag: boolean | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
          verified_at: string | null
          verified_by: string | null
          device_identifier: string | null
          guest_phone: string | null
          is_duplicate: boolean | null
          is_guest_report: boolean | null
          spam_risk_score: number | null
          tracking_id: string | null
        }
        Insert: {
          address?: string | null
          ai_analysis?: Json | null
          ai_confidence?: number | null
          asset_id?: string | null
          assigned_agency?: string | null
          assigned_to?: string | null
          citizen_confirmed_at?: string | null
          created_at?: string
          damage_type: string
          description: string
          duplicate_of?: string | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          fraud_flag?: boolean | null
          id?: string
          image_url?: string | null
          impact_score?: number | null
          inspection_notes?: string | null
          latitude: number
          longitude: number
          needs_human_review: boolean | null
          organization_id?: string | null
          people_affected?: number | null
          priority_score?: number | null
          reporter_email?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          safety_risk?: string | null
          severity?: string | null
          spam_flag?: boolean | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          device_identifier?: string | null
          guest_phone?: string | null
          is_duplicate?: boolean | null
          is_guest_report?: boolean | null
          spam_risk_score?: number | null
          tracking_id?: string | null
        }
        Update: {
          address?: string | null
          ai_analysis?: Json | null
          ai_confidence?: number | null
          asset_id?: string | null
          assigned_agency?: string | null
          assigned_to?: string | null
          citizen_confirmed_at?: string | null
          created_at?: string
          damage_type?: string
          description?: string
          duplicate_of?: string | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          fraud_flag?: boolean | null
          id?: string
          image_url?: string | null
          impact_score?: number | null
          inspection_notes?: string | null
          latitude?: number
          longitude?: number
          needs_human_review?: boolean | null
          organization_id?: string | null
          people_affected?: number | null
          priority_score?: number | null
          reporter_email?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          safety_risk?: string | null
          severity?: string | null
          spam_flag?: boolean | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          device_identifier?: string | null
          guest_phone?: string | null
          is_duplicate?: boolean | null
          is_guest_report?: boolean | null
          spam_risk_score?: number | null
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "infrastructure_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_credibility: {
        Row: {
          created_at: string
          rank: string
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          rank?: string
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          rank?: string
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users_with_roles: {
        Args: {
          search_query?: string | null
        }
        Returns: {
          created_at: string
          email: string | null
          email_confirmed_at: string | null
          last_sign_in_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      admin_set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
