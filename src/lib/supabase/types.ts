// Database types for Supabase
// These types match the schema in supabase/migrations/001_initial_schema.sql

export type OfficialStatus = 'official' | 'community' | 'unknown';
export type SourceType = 'manual' | 'auto' | 'unknown';
export type ReviewStatus = 'approved' | 'pending' | 'rejected';
export type FeedbackType = 'search_result' | 'video';

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
  review_status: ReviewStatus;
  relevance_score: number | null;
  relevance_reason: string | null;
  content_type: string | null;
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

export interface VideoFeedback {
  id: number;
  video_id: number;
  segment_id: number | null;
  feedback_type: FeedbackType;
  is_positive: boolean;
  query: string;
  reason: string | null;
  lang: string | null;
  session_id: string;
  created_at: string;
}

export interface QueryLog {
  id: number;
  query: string;
  normalized_query: string;
  lang: string | null;
  result_count: number;
  top_confidence: number | null;
  was_solved: boolean | null;
  session_id: string;
  created_at: string;
}

// Read-only aggregation views (see migration 007).
export interface VideoFeedbackStats {
  video_id: number;
  positive_count: number;
  negative_count: number;
  last_feedback_at: string | null;
}

export interface QueryGap {
  normalized_query: string;
  sample_query: string;
  search_count: number;
  unsolved_count: number;
  zero_result_count: number;
  avg_results: number | null;
  best_confidence_seen: number | null;
  last_searched_at: string | null;
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
      video_feedback: {
        Row: VideoFeedback;
        Insert: Omit<VideoFeedback, 'id' | 'created_at'> & { id?: number };
        Update: Partial<Omit<VideoFeedback, 'id' | 'created_at'>>;
      };
      query_log: {
        Row: QueryLog;
        Insert: Omit<QueryLog, 'id' | 'normalized_query' | 'created_at'> & { id?: number };
        Update: Partial<Omit<QueryLog, 'id' | 'normalized_query' | 'created_at'>>;
      };
    };
    Views: {
      video_feedback_stats: {
        Row: VideoFeedbackStats;
      };
      query_gaps: {
        Row: QueryGap;
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
          full_text_match: boolean;
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
  // True when this segment matched the full-text branch (segment text or video
  // title). Lets relevance filtering keep title/keyword matches whose semantic
  // similarity is 0 (see relevance-filter.ts).
  full_text_match: boolean;
}
