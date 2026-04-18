export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          plan: 'free' | 'pro' | 'agency';
          credits: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      creators: {
        Row: {
          id: string;
          user_id: string;
          instagram_handle: string;
          display_name: string | null;
          avatar_url: string | null;
          followers: number | null;
          niche: string | null;
          avg_engagement: number | null;
          last_scraped_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['creators']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['creators']['Insert']>;
      };
      viral_posts: {
        Row: {
          id: string;
          creator_id: string;
          instagram_post_id: string;
          caption: string | null;
          hook: string | null;
          hook_type: string | null;
          likes: number;
          comments: number;
          shares: number;
          engagement_rate: number | null;
          media_urls: string[];
          scraped_at: string;
          ai_analysis: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['viral_posts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['viral_posts']['Insert']>;
      };
      carousels: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          status: 'draft' | 'published' | 'scheduled';
          slides: Json;
          style_config: Json | null;
          source_post_id: string | null;
          thumbnail_url: string | null;
          scheduled_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['carousels']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['carousels']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
