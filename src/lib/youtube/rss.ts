// YouTube RSS feed fetcher - zero API quota cost
// Fetches recent video IDs from a channel's public Atom feed
import 'server-only';

export interface RssVideoEntry {
  videoId: string;
  title: string;
  publishedAt: string;
}

/**
 * Fetch the 15 most recent videos from a YouTube channel's RSS feed.
 * Uses the public Atom feed — costs 0 YouTube API quota.
 *
 * @param channelId - YouTube channel ID (e.g. UCxxxxxxxxxxxxx)
 * @returns Array of video entries (newest first)
 */
export async function fetchChannelRss(channelId: string): Promise<RssVideoEntry[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed for channel ${channelId}: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();

  // Parse <entry> blocks from Atom XML via regex (stable structure, no XML parser needed)
  const entries: RssVideoEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const block = entryMatch[1];

    const videoIdMatch = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = block.match(/<title>([^<]+)<\/title>/);
    const publishedMatch = block.match(/<published>([^<]+)<\/published>/);

    if (videoIdMatch) {
      entries.push({
        videoId: videoIdMatch[1],
        title: titleMatch?.[1] ?? 'Untitled',
        publishedAt: publishedMatch?.[1] ?? new Date().toISOString(),
      });
    }
  }

  return entries;
}
