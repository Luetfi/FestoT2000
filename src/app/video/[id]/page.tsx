import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { YouTubePlayer } from '@/components/video/youtube-player';
import { RelatedResults } from '@/components/video/related-results';
import { mockSegments } from '@/lib/mock-data/segments';
import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries/get-dictionary';
import { formatTimeRange, formatDuration } from '@/types/search';

interface VideoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function VideoPage({ params, searchParams }: VideoPageProps) {
  const { id } = await params;
  const { lang: langParam } = await searchParams;
  const lang = isValidLocale(langParam) ? langParam : defaultLocale;
  const dict = await getDictionary(lang);

  // Find the segment by ID
  const segment = mockSegments.find((s) => s.id === id);

  if (!segment) {
    notFound();
  }

  const isOfficial = segment.channel_official_status === 'official';
  const youtubeUrl = `https://www.youtube.com/watch?v=${segment.video_youtube_id}&t=${segment.start_time}s`;
  const timeRange = formatTimeRange(segment.start_time, segment.end_time);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link href={`/search?lang=${lang}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {dict.searchResults}
            </Button>
          </Link>
          <Link
            href={`/?lang=${lang}`}
            className="text-xl font-bold text-foreground hover:text-foreground/80 transition-colors"
          >
            {dict.appTitle}
          </Link>
        </div>
      </header>

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
                  "{segment.text}"
                </p>
              </div>

              {/* Open on YouTube button */}
              <Button asChild variant="outline">
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
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
              segments={mockSegments}
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
