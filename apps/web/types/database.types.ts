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
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          level: number
          xp: number
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          level?: number
          xp?: number
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
          level?: number
          xp?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedSchema: "auth"
          }
        ]
      }
      rooms: {
        Row: {
          id: string
          name: string
          created_at: string
          status: 'waiting' | 'playing' | 'finished'
          max_players: number
          current_players: number
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          status?: 'waiting' | 'playing' | 'finished'
          max_players?: number
          current_players?: number
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          status?: 'waiting' | 'playing' | 'finished'
          max_players?: number
          current_players?: number
        }
        Relationships: []
      }
      match_history: {
        Row: {
          id: string
          player_id: string
          room_id: string | null
          score: number
          kills: number
          xp_earned: number
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          room_id?: string | null
          score?: number
          kills?: number
          xp_earned?: number
          created_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          room_id?: string | null
          score?: number
          kills?: number
          xp_earned?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_history_player_id_fkey"
            columns: ["player_id"]
            referencedRelation: "profiles"
            referencedSchema: "public"
          },
          {
            foreignKeyName: "match_history_room_id_fkey"
            columns: ["room_id"]
            referencedRelation: "rooms"
            referencedSchema: "public"
          }
        ]
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
