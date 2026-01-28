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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_evaluation_log: {
        Row: {
          ai_prompt: string
          ai_provider: string
          ai_response: string
          ai_score: number
          created_at: string | null
          evaluation_time_ms: number | null
          id: string
          question_id: string
          question_text: string
          round_id: string
          submission_id: string
          team_answer: string
          team_id: string
        }
        Insert: {
          ai_prompt: string
          ai_provider: string
          ai_response: string
          ai_score: number
          created_at?: string | null
          evaluation_time_ms?: number | null
          id?: string
          question_id: string
          question_text: string
          round_id: string
          submission_id: string
          team_answer: string
          team_id: string
        }
        Update: {
          ai_prompt?: string
          ai_provider?: string
          ai_response?: string
          ai_score?: number
          created_at?: string | null
          evaluation_time_ms?: number | null
          id?: string
          question_id?: string
          question_text?: string
          round_id?: string
          submission_id?: string
          team_answer?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluation_log_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_evaluation_log_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_evaluation_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_evaluation_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      game_state: {
        Row: {
          current_round: number | null
          id: string
          is_competition_active: boolean | null
          round_end_time: string | null
          round_start_time: string | null
          updated_at: string | null
        }
        Insert: {
          current_round?: number | null
          id?: string
          is_competition_active?: boolean | null
          round_end_time?: string | null
          round_start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          current_round?: number | null
          id?: string
          is_competition_active?: boolean | null
          round_end_time?: string | null
          round_start_time?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      question_locks: {
        Row: {
          expires_at: string
          id: string
          is_active: boolean | null
          locked_at: string | null
          question_id: string
          released_at: string | null
          round_id: string
          team_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          is_active?: boolean | null
          locked_at?: string | null
          question_id: string
          released_at?: string | null
          round_id: string
          team_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          is_active?: boolean | null
          locked_at?: string | null
          question_id?: string
          released_at?: string | null
          round_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_locks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_locks_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_locks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answered_by: string | null
          category: string | null
          constraints: string | null
          correct_answer: string | null
          created_at: string | null
          difficulty: string | null
          id: string
          is_locked: boolean | null
          jeopardy_col: number | null
          jeopardy_row: number | null
          locked_at: string | null
          locked_by: string | null
          options: Json | null
          points: number | null
          question_text: string
          question_type: string
          reward_points: number | null
          round_id: string | null
        }
        Insert: {
          answered_by?: string | null
          category?: string | null
          constraints?: string | null
          correct_answer?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_locked?: boolean | null
          jeopardy_col?: number | null
          jeopardy_row?: number | null
          locked_at?: string | null
          locked_by?: string | null
          options?: Json | null
          points?: number | null
          question_text: string
          question_type: string
          reward_points?: number | null
          round_id?: string | null
        }
        Update: {
          answered_by?: string | null
          category?: string | null
          constraints?: string | null
          correct_answer?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_locked?: boolean | null
          jeopardy_col?: number | null
          jeopardy_row?: number | null
          locked_at?: string | null
          locked_by?: string | null
          options?: Json | null
          points?: number | null
          question_text?: string
          question_type?: string
          reward_points?: number | null
          round_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          created_at: string | null
          end_time: string | null
          id: string
          is_active: boolean | null
          round_name: string
          round_number: number
          round_type: string
          start_time: string | null
          time_limit_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          round_name: string
          round_number: number
          round_type: string
          start_time?: string | null
          time_limit_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          round_name?: string
          round_number?: number
          round_type?: string
          start_time?: string | null
          time_limit_seconds?: number | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          answer: string
          evaluated_at: string | null
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string
          round_id: string
          submitted_at: string | null
          team_id: string
        }
        Insert: {
          answer: string
          evaluated_at?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id: string
          round_id: string
          submitted_at?: string | null
          team_id: string
        }
        Update: {
          answer?: string
          evaluated_at?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string
          round_id?: string
          submitted_at?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          current_round: number | null
          eliminated_at: string | null
          id: string
          is_active: boolean | null
          is_disqualified: boolean | null
          leader_email: string
          password_hash: string
          round_eliminated: number | null
          round1_score: number | null
          round2_score: number | null
          round3_score: number | null
          team_code: string
          team_name: string
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_round?: number | null
          eliminated_at?: string | null
          id?: string
          is_active?: boolean | null
          is_disqualified?: boolean | null
          leader_email: string
          password_hash: string
          round_eliminated?: number | null
          round1_score?: number | null
          round2_score?: number | null
          round3_score?: number | null
          team_code: string
          team_name: string
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_round?: number | null
          eliminated_at?: string | null
          id?: string
          is_active?: boolean | null
          is_disqualified?: boolean | null
          leader_email?: string
          password_hash?: string
          round_eliminated?: number | null
          round1_score?: number | null
          round2_score?: number | null
          round3_score?: number | null
          team_code?: string
          team_name?: string
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "user"
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
      app_role: ["admin", "supervisor", "user"],
    },
  },
} as const
