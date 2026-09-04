/**
 * Search result types for UI components
 * These flatten the normalized database schema for easier rendering
 */

export type OfficialStatus = 'official' | 'community' | 'unknown';

export interface SearchResultSegment {
  // Segment data
  id: string;
  text: string;
  summary: string | null;
  start_time: number;
  end_time: number;
  similarity: number;
  semantic_similarity: number;
  // True when the segment surfaced via full-text (segment text or video title)
  // rather than only semantic similarity. Used to keep exact title/keyword
  // matches that have semantic_similarity 0 from being pre-filtered out.
  full_text_match: boolean;
  // 0-100 confidence (LLM judge) that this segment answers the query.
  // Set by the search API; optional because segments built elsewhere don't have it.
  confidence?: number;
  // True when this segment is not itself a hit but was added by the search API
  // as the video's jump target (see segment-picker.ts). Such a segment is the
  // one the user should start at; it must not be counted as an extra match.
  injected?: boolean;

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

// A suggested, more precise search term shown when a query yields weak results.
export interface QuerySuggestion {
  term: string;
  // Optional short rationale, shown as a tooltip on the suggestion chip.
  reason?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResultSegment[];
  total: number;
  // Better search terms suggested when the result set is weak; empty otherwise.
  suggestions: QuerySuggestion[];
  // Id of the query_log row this search created; lets the client attach an
  // explicit "did this solve your problem?" answer. Absent if logging failed.
  queryLogId?: number;
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

export type RelevanceLevel = 'high' | 'medium' | 'low';

// Map an LLM confidence score (0-100, "how sure this segment answers the query")
// to a relevance level + rounded percentage for display.
export function getRelevanceLevel(confidence: number): {
  level: RelevanceLevel;
  percent: number;
} {
  const percent = Math.round(confidence);
  if (percent >= 85) return { level: 'high', percent };
  if (percent >= 60) return { level: 'medium', percent };
  return { level: 'low', percent };
}
