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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      content_jobs: {
        Row: {
          aig_run_id: string | null
          blog_post: string | null
          created_at: string
          email_newsletter: string | null
          error_message: string | null
          id: string
          linkedin_carousel: Json | null
          source_type: string
          source_url: string | null
          status: string
          title: string
          transcript: string | null
          transcript_truncated: boolean
          twitter_threads: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aig_run_id?: string | null
          blog_post?: string | null
          created_at?: string
          email_newsletter?: string | null
          error_message?: string | null
          id?: string
          linkedin_carousel?: Json | null
          source_type: string
          source_url?: string | null
          status?: string
          title?: string
          transcript?: string | null
          transcript_truncated?: boolean
          twitter_threads?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aig_run_id?: string | null
          blog_post?: string | null
          created_at?: string
          email_newsletter?: string | null
          error_message?: string | null
          id?: string
          linkedin_carousel?: Json | null
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string
          transcript?: string | null
          transcript_truncated?: boolean
          twitter_threads?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs_queue: {
        Row: {
          attempts: number
          created_at: string
          job_id: string
          last_error: string | null
          locked_until: string | null
          max_attempts: number
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          job_id: string
          last_error?: string | null
          locked_until?: string | null
          max_attempts?: number
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          job_id?: string
          last_error?: string | null
          locked_until?: string | null
          max_attempts?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "content_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          user_id: string
        }
        Insert: {
          bucket: string
          count?: number
          user_id: string
        }
        Update: {
          bucket?: string
          count?: number
          user_id?: string
        }
        Relationships: []
      }
      usage_monthly: {
        Row: {
          characters_processed: number
          jobs_count: number
          updated_at: string
          user_id: string
          year_month: string
        }
        Insert: {
          characters_processed?: number
          jobs_count?: number
          updated_at?: string
          user_id: string
          year_month: string
        }
        Update: {
          characters_processed?: number
          jobs_count?: number
          updated_at?: string
          user_id?: string
          year_month?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_quota_and_rate_limit: { Args: never; Returns: Json }
      claim_jobs: {
        Args: { p_limit?: number; p_lock_seconds?: number }
        Returns: {
          attempts: number
          job_id: string
          user_id: string
        }[]
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      complete_job: { Args: { p_job_id: string }; Returns: undefined }
      complete_job_and_charge: {
        Args: { p_delta: number; p_job_id: string; p_user: string }
        Returns: undefined
      }
      decrement_quota: {
        Args: { p_month: string; p_user: string }
        Returns: undefined
      }
      fail_job: {
        Args: { p_error: string; p_job_id: string }
        Returns: undefined
      }
      fail_job_permanent: {
        Args: { p_error: string; p_job_id: string }
        Returns: undefined
      }
      increment_usage_chars: {
        Args: { p_delta: number; p_user: string }
        Returns: undefined
      }
      submit_content_job: {
        Args: {
          p_source_type: string
          p_source_url: string
          p_title: string
          p_transcript: string
        }
        Returns: Json
      }
      try_acquire_drain_lock: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
