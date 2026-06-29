export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      voice_agents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          role: string;
          bio: string | null;
          voice: string;
          avatar_url: string | null;
          client_info: string | null;
          prior_conversation: string | null;
          custom_role: string | null;
          model_engine: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          role?: string;
          bio?: string | null;
          voice?: string;
          avatar_url?: string | null;
          client_info?: string | null;
          prior_conversation?: string | null;
          custom_role?: string | null;
          model_engine?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['voice_agents']['Insert']>;
        Relationships: [];
      };
      voice_sessions: {
        Row: {
          id: string;
          user_id: string;
          agent_id: string | null;
          status: string;
          model_engine: string;
          duration_seconds: number;
          transcript: Json;
          metadata: Json;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          agent_id?: string | null;
          status?: string;
          model_engine?: string;
          duration_seconds?: number;
          transcript?: Json;
          metadata?: Json;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['voice_sessions']['Insert']>;
        Relationships: [];
      };
      voice_calls: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          phone_number: string;
          direction: string;
          provider: string;
          call_sid: string | null;
          status: string;
          duration_seconds: number;
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          phone_number: string;
          direction?: string;
          provider?: string;
          call_sid?: string | null;
          status?: string;
          duration_seconds?: number;
          created_at?: string;
          ended_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['voice_calls']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          company_name: string | null;
          job_title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          company_name?: string | null;
          job_title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type VoiceAgent = Database['public']['Tables']['voice_agents']['Row'];
export type VoiceSession = Database['public']['Tables']['voice_sessions']['Row'];
export type VoiceCall = Database['public']['Tables']['voice_calls']['Row'];
