// Database types for Supabase
// These types match the schema in supabase/migrations/001_initial_schema.sql

export type OfficialStatus = 'official' | 'community' | 'unknown';
export type SourceType = 'manual' | 'auto' | 'unknown';

export interface Channel {
  id: number;
  youtube_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  official_status: OfficialStatus;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: number;
  channel_id: number | null;
  youtube_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  has_transcript: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: number;
  video_id: number | null;
  full_text: string;
  language: string;
  source_type: SourceType;
  created_at: string;
}

export interface Segment {
  id: number;
  video_id: number | null;
  transcript_id: number | null;
  text: string;
  summary: string | null;
  explanation: string | null;
  start_time: number;
  end_time: number;
  embedding: number[] | null;
  created_at: string;
}

// Supabase Database type for generic client
export interface Database {
  public: {
    Tables: {
      channels: {
        Row: Channel;
        Insert: Omit<Channel, 'id' | 'created_at' | 'updated_at'> & { id?: number };
        Update: Partial<Omit<Channel, 'id' | 'created_at' | 'updated_at'>>;
      };
      videos: {
        Row: Video;
        Insert: Omit<Video, 'id' | 'created_at' | 'updated_at'> & { id?: number };
        Update: Partial<Omit<Video, 'id' | 'created_at' | 'updated_at'>>;
      };
      transcripts: {
        Row: Transcript;
        Insert: Omit<Transcript, 'id' | 'created_at'> & { id?: number };
        Update: Partial<Omit<Transcript, 'id' | 'created_at'>>;
      };
      segments: {
        Row: Segment;
        Insert: Omit<Segment, 'id' | 'created_at'> & { id?: number };
        Update: Partial<Omit<Segment, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      search_segments: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: number;
          video_id: number;
          text: string;
          start_time: number;
          end_time: number;
          similarity: number;
        }[];
      };
      hybrid_search_segments: {
        Args: {
          query_text: string;
          query_embedding: number[];
          match_count?: number;
          full_text_weight?: number;
          semantic_weight?: number;
          rrf_k?: number;
        };
        Returns: {
          id: number;
          video_id: number;
          text: string;
          start_time: number;
          end_time: number;
          rrf_score: number;
          semantic_similarity: number;
        }[];
      };
    };
  };
}

// Helper type for search results
export interface SearchResult {
  id: number;
  video_id: number;
  text: string;
  start_time: number;
  end_time: number;
  similarity: number;
}

// Helper type for hybrid search results
export interface HybridSearchResult {
  id: number;
  video_id: number;
  text: string;
  start_time: number;
  end_time: number;
  rrf_score: number;
  semantic_similarity: number;
}
