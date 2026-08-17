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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_deletion_jobs: {
        Row: {
          account_id: string | null
          attempt_count: number
          completed_at: string | null
          created_at: string
          deletion_request_id: string
          last_error_code: string | null
          lease_until: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          deletion_request_id: string
          last_error_code?: string | null
          lease_until?: string | null
          requested_at: string
          status: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          deletion_request_id?: string
          last_error_code?: string | null
          lease_until?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_id: string
          created_at: string
          deleted_at: string | null
          role: Database["public"]["Enums"]["account_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          deleted_at?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          deleted_at?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      auth_bindings: {
        Row: {
          account_id: string
          auth_backend: string
          backend_user_id: string
          created_at: string
          last_used_at: string
        }
        Insert: {
          account_id: string
          auth_backend: string
          backend_user_id: string
          created_at?: string
          last_used_at?: string
        }
        Update: {
          account_id?: string
          auth_backend?: string
          backend_user_id?: string
          created_at?: string
          last_used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_bindings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      community_suggestions: {
        Row: {
          author_account_id: string | null
          author_label: string
          created_at: string
          details: string
          guest_id_hash: string | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          published_at: string | null
          status: Database["public"]["Enums"]["community_suggestion_status"]
          suggestion_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_account_id?: string | null
          author_label: string
          created_at?: string
          details: string
          guest_id_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["community_suggestion_status"]
          suggestion_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_account_id?: string | null
          author_label?: string
          created_at?: string
          details?: string
          guest_id_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["community_suggestion_status"]
          suggestion_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_suggestions_author_account_id_fkey"
            columns: ["author_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "community_suggestions_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      community_votes: {
        Row: {
          account_id: string
          created_at: string
          suggestion_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          suggestion_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "community_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "community_suggestions"
            referencedColumns: ["suggestion_id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          account_id: string
          best_score: number
          calculated_at: string
          games_count: number
          handle: string
          latest_completed_at: string
          rank: number
          scope_key: string
          score: number
          total_response_time_ms: number
        }
        Insert: {
          account_id: string
          best_score: number
          calculated_at?: string
          games_count: number
          handle: string
          latest_completed_at: string
          rank: number
          scope_key: string
          score: number
          total_response_time_ms: number
        }
        Update: {
          account_id?: string
          best_score?: number
          calculated_at?: string
          games_count?: number
          handle?: string
          latest_completed_at?: string
          rank?: number
          scope_key?: string
          score?: number
          total_response_time_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["account_id"]
          },
        ]
      }
      login_identities: {
        Row: {
          account_id: string
          last_used_at: string
          provider: Database["public"]["Enums"]["login_provider"]
          provider_subject: string
          verified_at: string
        }
        Insert: {
          account_id: string
          last_used_at: string
          provider: Database["public"]["Enums"]["login_provider"]
          provider_subject: string
          verified_at: string
        }
        Update: {
          account_id?: string
          last_used_at?: string
          provider?: Database["public"]["Enums"]["login_provider"]
          provider_subject?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_identities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          event_id: string
          internal_note: string | null
          previous_integrity_status:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          projection_completed_at: string | null
          projection_status: string
          reason_code: string
          resulting_integrity_status:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          event_id: string
          internal_note?: string | null
          previous_integrity_status?:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          projection_completed_at?: string | null
          projection_status?: string
          reason_code: string
          resulting_integrity_status?:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_id?: string
          internal_note?: string | null
          previous_integrity_status?:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          projection_completed_at?: string | null
          projection_status?: string
          reason_code?: string
          resulting_integrity_status?:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string
          avatar_key: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          handle: string
          normalized_handle: string
          revision: number
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          visibility: string
        }
        Insert: {
          account_id: string
          avatar_key?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          handle: string
          normalized_handle: string
          revision?: number
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          visibility?: string
        }
        Update: {
          account_id?: string
          avatar_key?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          handle?: string
          normalized_handle?: string
          revision?: number
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      location_difficulty_metrics: {
        Row: {
          calculated_at: string
          confidence: string
          location_id: string
          median_response_ratio: number
          success_rate: number
          suggested_difficulty: string
          average_points: number
          verified_rounds: number
        }
        Insert: {
          calculated_at?: string
          confidence: string
          location_id: string
          median_response_ratio: number
          success_rate: number
          suggested_difficulty: string
          average_points: number
          verified_rounds: number
        }
        Update: {
          calculated_at?: string
          confidence?: string
          location_id?: string
          median_response_ratio?: number
          success_rate?: number
          suggested_difficulty?: string
          average_points?: number
          verified_rounds?: number
        }
        Relationships: []
      }
      ranked_games: {
        Row: {
          account_id: string | null
          category: string
          difficulty: string
          claimed_at: string | null
          completed_at: string | null
          completed_rounds: number
          create_request_id: string
          created_at: string
          expires_at: string | null
          game_id: string
          guest_id_hash: string | null
          integrity_reasons: string[]
          integrity_status: Database["public"]["Enums"]["integrity_status"]
          planned_rounds: number
          no_zoom: boolean
          revision: number
          round_duration_ms: number
          ruleset_id: string
          ruleset_version: number
          score: number
          scoring_version: string
          started_at: string
          status: Database["public"]["Enums"]["game_status"]
          total_response_time_ms: number
          time_limit_sec: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category: string
          difficulty?: string
          claimed_at?: string | null
          completed_at?: string | null
          completed_rounds?: number
          create_request_id: string
          created_at?: string
          expires_at?: string | null
          game_id: string
          guest_id_hash?: string | null
          integrity_reasons?: string[]
          integrity_status: Database["public"]["Enums"]["integrity_status"]
          planned_rounds: number
          no_zoom?: boolean
          revision?: number
          round_duration_ms: number
          ruleset_id: string
          ruleset_version: number
          score?: number
          scoring_version: string
          started_at: string
          status: Database["public"]["Enums"]["game_status"]
          total_response_time_ms?: number
          time_limit_sec?: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category?: string
          difficulty?: string
          claimed_at?: string | null
          completed_at?: string | null
          completed_rounds?: number
          create_request_id?: string
          created_at?: string
          expires_at?: string | null
          game_id?: string
          guest_id_hash?: string | null
          integrity_reasons?: string[]
          integrity_status?: Database["public"]["Enums"]["integrity_status"]
          planned_rounds?: number
          no_zoom?: boolean
          revision?: number
          round_duration_ms?: number
          ruleset_id?: string
          ruleset_version?: number
          score?: number
          scoring_version?: string
          started_at?: string
          status?: Database["public"]["Enums"]["game_status"]
          total_response_time_ms?: number
          time_limit_sec?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranked_games_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      ranked_guesses: {
        Row: {
          badge: string
          country_code: string | null
          country_correct: boolean
          distance_km: number
          game_id: string
          guess_id: string
          lat: number
          lng: number
          points: number
          response_time_ms: number
          result_snapshot: Json
          round_id: string
          submitted_at: string
        }
        Insert: {
          badge: string
          country_code?: string | null
          country_correct: boolean
          distance_km: number
          game_id: string
          guess_id: string
          lat: number
          lng: number
          points: number
          response_time_ms: number
          result_snapshot: Json
          round_id: string
          submitted_at: string
        }
        Update: {
          badge?: string
          country_code?: string | null
          country_correct?: boolean
          distance_km?: number
          game_id?: string
          guess_id?: string
          lat?: number
          lng?: number
          points?: number
          response_time_ms?: number
          result_snapshot?: Json
          round_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranked_guesses_round_id_game_id_fkey"
            columns: ["round_id", "game_id"]
            isOneToOne: false
            referencedRelation: "ranked_rounds"
            referencedColumns: ["round_id", "game_id"]
          },
        ]
      }
      ranked_rounds: {
        Row: {
          deadline_at: string | null
          game_id: string
          location_id: string
          location_snapshot: Json
          resolved_at: string | null
          round_id: string
          round_number: number
          started_at: string | null
          status: string
        }
        Insert: {
          deadline_at?: string | null
          game_id: string
          location_id: string
          location_snapshot: Json
          resolved_at?: string | null
          round_id: string
          round_number: number
          started_at?: string | null
          status: string
        }
        Update: {
          deadline_at?: string | null
          game_id?: string
          location_id?: string
          location_snapshot?: Json
          resolved_at?: string | null
          round_id?: string
          round_number?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranked_rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "ranked_games"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "ranked_rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "verified_ranked_results"
            referencedColumns: ["game_id"]
          },
        ]
      }
    }
    Views: {
      verified_ranked_results: {
        Row: {
          account_id: string | null
          category: string | null
          difficulty: string | null
          completed_at: string | null
          game_id: string | null
          handle: string | null
          no_zoom: boolean | null
          planned_rounds: number | null
          ruleset_id: string | null
          ruleset_version: number | null
          score: number | null
          scoring_version: string | null
          total_response_time_ms: number | null
          time_limit_sec: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ranked_games_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
    }
    Functions: {
      persist_ranked_game_state: {
        Args: {
          p_expected_revision: number | null
          p_game: Json
          p_rounds: Json
          p_guesses: Json
        }
        Returns: number
      }
      resolve_account_identity: {
        Args: {
          p_auth_backend: string
          p_backend_user_id: string
          p_login_provider: Database["public"]["Enums"]["login_provider"]
          p_new_account_id: string
          p_now: string
          p_provider_subject: string
          p_target_account_id?: string
          p_verified_at: string
        }
        Returns: Json
      }
    }
    Enums: {
      account_role: "player" | "admin"
      account_status: "active" | "restricted" | "deleted"
      community_suggestion_status:
        | "pending"
        | "approved"
        | "planned"
        | "in_progress"
        | "completed"
        | "declined"
      game_status: "active" | "completed"
      integrity_status: "verified" | "flagged" | "invalid"
      login_provider: "email" | "google" | "apple"
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
      account_role: ["player", "admin"],
      account_status: ["active", "restricted", "deleted"],
      community_suggestion_status: ["pending", "approved", "planned", "in_progress", "completed", "declined"],
      game_status: ["active", "completed"],
      integrity_status: ["verified", "flagged", "invalid"],
      login_provider: ["email", "google", "apple"],
    },
  },
} as const
