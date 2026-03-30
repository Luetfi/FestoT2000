// YouTube transcript fetching - server-only
// Fetch transcripts with timestamps, graceful error handling
//
// Uses youtube-transcript for reliable server-side transcript fetching.
// Fallback chain: German captions → English captions → unavailable
import 'server-only';

// @ts-expect-error - youtube-transcript v1.3.0 has broken package.json exports
import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';

/**
 * Transcript segment with timestamp metadata
 * Timestamps are in milliseconds from video start
 */
export interface TranscriptSegment {
  text: string;
  offset: number; // milliseconds from video start
  duration: number; // milliseconds duration of segment
}

/**
 * Result of transcript fetch attempt
 * Always returns an object, never throws
 */
export interface TranscriptResult {
  segments: TranscriptSegment[];
  language: string; // 'de', 'en', or 'unknown'
  source: 'manual' | 'auto' | 'unknown';
  available: boolean;
}

/**
 * Fetch video transcript with fallback strategy
 * Try German first, then English, graceful error handling
 *
 * @param videoId - YouTube video ID
 * @returns TranscriptResult with available: false if transcript unavailable
 */
export async function fetchVideoTranscript(
  videoId: string
): Promise<TranscriptResult> {
  // Try German first (primary target audience)
  const deResult = await tryFetchTranscript(videoId, 'de');
  if (deResult) return deResult;

  // Try English fallback
  const enResult = await tryFetchTranscript(videoId, 'en');
  if (enResult) return enResult;

  // No transcript available (only DE/EN accepted for hybrid search compatibility)
  console.warn(`Transcript unavailable for video ${videoId}`);
  return {
    segments: [],
    language: 'unknown',
    source: 'unknown',
    available: false,
  };
}

async function tryFetchTranscript(
  videoId: string,
  lang: string | undefined
): Promise<TranscriptResult | null> {
  try {
    const subtitles = await fetchTranscript(videoId, { lang });

    if (!subtitles || subtitles.length === 0) return null;

    const segments: TranscriptSegment[] = subtitles.map((sub: any) => ({
      text: sub.text,
      offset: Math.round(sub.offset),
      duration: Math.round(sub.duration),
    }));

    return {
      segments,
      language: lang || subtitles[0]?.lang || 'unknown',
      source: 'unknown',
      available: true,
    };
  } catch (error) {
    console.warn(
      `Transcript fetch failed for ${videoId} (lang=${lang}):`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}
