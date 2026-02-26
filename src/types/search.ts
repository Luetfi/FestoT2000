/**
 * Search result types for UI components
 * These flatten the normalized database schema for easier rendering
 */

export type OfficialStatus = 'official' | 'community' | 'unknown';

export interface SearchResultSegment {
  // Segment data
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  similarity: number;
  semantic_similarity: number;

  // Video data (denormalized)
  video_id: string;
  video_youtube_id: string;
  video_title: string;
  video_description: string | null;
  video_thumbnail_url: string;
  video_duration_seconds: number | null;
  video_has_transcript: boolean;

  // Channel data (denormalized)
  channel_name: string;
  channel_official_status: OfficialStatus;
}

export interface VideoResult {
  id: string;
  youtube_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  duration_seconds: number | null;
  has_transcript: boolean;
  channel_name: string;
  channel_official_status: OfficialStatus;
  segments: Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
  }>;
}

export interface SearchResponse {
  query: string;
  results: SearchResultSegment[];
  total: number;
}

export interface QuickFilter {
  id: string;
  label: string;
  query: string;
}

// Helper to format duration from seconds
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Helper to format segment time range
export function formatTimeRange(startTime: number, endTime: number): string {
  return `${formatDuration(startTime)} - ${formatDuration(endTime)}`;
}
