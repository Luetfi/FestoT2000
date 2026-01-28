// YouTube Data API client - server-only
// YouTube API key is never exposed to client
import 'server-only';
import { google, youtube_v3 } from 'googleapis';

let _youtube: youtube_v3.Youtube | null = null;

function getYouTube(): youtube_v3.Youtube {
  if (_youtube) return _youtube;

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY environment variable');
  }

  _youtube = google.youtube({
    version: 'v3',
    auth: apiKey,
  });

  return _youtube;
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string | null;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
}

export interface ChannelMetadata {
  channelId: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
}

/**
 * Parse ISO 8601 duration (PT1H2M3S) to seconds
 */
function parseDuration(duration: string | null | undefined): number | null {
  if (!duration) return null;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetch video metadata from YouTube Data API
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const youtube = getYouTube();
  const response = await youtube.videos.list({
    part: ['snippet', 'contentDetails'],
    id: [videoId],
  });

  if (!response.data.items || response.data.items.length === 0) {
    throw new Error(`Video not found: ${videoId}`);
  }

  const video = response.data.items[0];
  const snippet = video.snippet;
  const contentDetails = video.contentDetails;

  if (!snippet) {
    throw new Error(`Video missing snippet data: ${videoId}`);
  }

  return {
    videoId,
    title: snippet.title || 'Untitled',
    description: snippet.description || null,
    channelId: snippet.channelId || '',
    channelTitle: snippet.channelTitle || 'Unknown Channel',
    thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
    publishedAt: snippet.publishedAt || null,
    durationSeconds: parseDuration(contentDetails?.duration),
  };
}

/**
 * Fetch channel metadata from YouTube Data API
 */
export async function fetchChannelMetadata(channelId: string): Promise<ChannelMetadata> {
  const youtube = getYouTube();
  const response = await youtube.channels.list({
    part: ['snippet'],
    id: [channelId],
  });

  if (!response.data.items || response.data.items.length === 0) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const channel = response.data.items[0];
  const snippet = channel.snippet;

  if (!snippet) {
    throw new Error(`Channel missing snippet data: ${channelId}`);
  }

  return {
    channelId,
    name: snippet.title || 'Unknown Channel',
    description: snippet.description || null,
    thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
  };
}

/**
 * Determine if channel is official based on name containing "festo"
 * Can be overridden via ENV allowlist/blocklist
 * Blocklist takes precedence (security), then allowlist, then default
 */
export function classifyChannel(channelName: string): 'official' | 'community' {
  const normalized = channelName.toLowerCase().trim();

  // Blocklist takes precedence (security: prevent false positives)
  const blocklist = process.env.CHANNEL_BLOCKLIST?.split(',')
    .map(c => c.trim().toLowerCase())
    .filter(c => c.length > 0) || [];

  if (blocklist.some(blocked => normalized.includes(blocked))) {
    return 'community';
  }

  // Allowlist before default (flexibility: add official partners)
  const allowlist = process.env.CHANNEL_ALLOWLIST?.split(',')
    .map(c => c.trim().toLowerCase())
    .filter(c => c.length > 0) || [];

  if (allowlist.some(allowed => normalized.includes(allowed))) {
    return 'official';
  }

  // Default classification (case-insensitive "festo" keyword)
  return normalized.includes('festo') ? 'official' : 'community';
}
