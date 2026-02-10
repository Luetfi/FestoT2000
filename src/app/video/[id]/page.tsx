import 'server-only';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLinkIcon, ArrowLeftIcon } from '@/components/icons/festo-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { YouTubePlayer } from '@/components/video/youtube-player';
import { RelatedResults } from '@/components/video/related-results';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries/get-dictionary';
import { formatTimeRange, formatDuration } from '@/types/search';
import type { SearchResultSegment, OfficialStatus } from '@/types/search';

interface VideoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function VideoPage({ params, searchParams }: VideoPageProps) {
  const { id } = await params;
  const { lang: langParam } = await searchParams;
  const lang = isValidLocale(langParam) ? langParam : defaultLocale;
  const dict = await getDictionary(lang);

  // Parse segment ID as number for DB query
  const segmentId = parseInt(id, 10);
  if (isNaN(segmentId)) {
    notFound();
  }

  const supabase = getSupabaseAdmin();

  // Load segment from DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: segmentRow }: { data: any } = await supabase
    .from('segments')
    .select('id, text, start_time, end_time, video_id')
    .eq('id', segmentId)
    .single();

  if (!segmentRow) {
    notFound();
  }

  // Load video with channel data (same pattern as enrichment.ts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: video }: { data: any } = await supabase
    .from('videos')
    .select(`
      id,
      youtube_id,
      title,
      description,
      thumbnail_url,
      duration_seconds,
      has_transcript,
      channels (
        name,
        official_status
      )
    `)
    .eq('id', segmentRow.video_id)
    .single();

  const channel = video?.channels?.[0] || video?.channels;

  const segment: SearchResultSegment = {
    id: String(segmentRow.id),
    text: segmentRow.text,
    start_time: segmentRow.start_time,
    end_time: segmentRow.end_time,
    similarity: 0,
    video_id: String(segmentRow.video_id),
    video_youtube_id: video?.youtube_id ?? '',
    video_title: video?.title ?? '',
    video_description: video?.description ?? null,
    video_thumbnail_url: video?.thumbnail_url ?? '',
    video_duration_seconds: video?.duration_seconds ?? null,
    video_has_transcript: video?.has_transcript ?? false,
    channel_name: channel?.name ?? 'Unknown',
    channel_official_status: (channel?.official_status as OfficialStatus) ?? 'unknown',
  };

  // Load related segments from the same video
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: relatedRows }: { data: any[] | null } = await supabase
    .from('segments')
    .select('id, text, start_time, end_time, video_id')
    .eq('video_id', segmentRow.video_id)
    .neq('id', segmentRow.id)
    .order('start_time', { ascending: true })
    .limit(5);

  const relatedSegments: SearchResultSegment[] = (relatedRows || []).map((row) => ({
    id: String(row.id),
    text: row.text,
    start_time: row.start_time,
    end_time: row.end_time,
    similarity: 0,
    video_id: String(row.video_id),
    // Related segments share the same video, reuse video/channel data
    video_youtube_id: video?.youtube_id ?? '',
    video_title: video?.title ?? '',
    video_description: video?.description ?? null,
    video_thumbnail_url: video?.thumbnail_url ?? '',
    video_duration_seconds: video?.duration_seconds ?? null,
    video_has_transcript: video?.has_transcript ?? false,
    channel_name: channel?.name ?? 'Unknown',
    channel_official_status: (channel?.official_status as OfficialStatus) ?? 'unknown',
  }));

  const isOfficial = segment.channel_official_status === 'official';
  const youtubeUrl = `https://www.youtube.com/watch?v=${segment.video_youtube_id}&t=${segment.start_time}s`;
  const timeRange = formatTimeRange(segment.start_time, segment.end_time);

  return (
    <div className="min-h-screen bg-background">
      {/* Back navigation */}
      <div className="px-4 py-3 border-b">
        <Link href={`/search?lang=${lang}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon size={16} className="mr-2" />
            {dict.searchResults}
          </Button>
        </Link>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-8">
          {/* Video player and info - 2 columns */}
          <div className="col-span-2 space-y-6">
            {/* Video Player */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <YouTubePlayer
                videoId={segment.video_youtube_id}
                startTime={segment.start_time}
                className="w-full h-full"
              />
            </div>

            {/* Video Info */}
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">{segment.video_title}</h1>

              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {segment.channel_name}
                </span>
                <Badge variant={isOfficial ? 'default' : 'secondary'}>
                  {isOfficial ? dict.officialLabel : dict.communityLabel}
                </Badge>
              </div>

              {/* No transcript notice */}
              {!segment.video_has_transcript && (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
                  {dict.noTranscriptNotice}
                </p>
              )}

              {/* Segment info */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    <span className="font-medium">{dict.segmentDuration}:</span>{' '}
                    {timeRange}
                  </span>
                  {segment.video_duration_seconds && (
                    <span>
                      <span className="font-medium">{dict.videoDuration}:</span>{' '}
                      {formatDuration(segment.video_duration_seconds)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground italic">
                  &ldquo;{segment.text}&rdquo;
                </p>
              </div>

              {/* Open on YouTube button */}
              <Button asChild variant="outline">
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon size={16} className="mr-2" />
                  {dict.openOnYouTube}
                </a>
              </Button>

              {/* Video description */}
              {segment.video_description && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {segment.video_description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Related results - 1 column */}
          <div className="col-span-1">
            <RelatedResults
              currentSegmentId={segment.id}
              segments={relatedSegments}
              lang={lang}
              labels={{
                official: dict.officialLabel,
                community: dict.communityLabel,
                relatedVideos: dict.relatedVideos,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
