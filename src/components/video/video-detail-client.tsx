'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ExternalLinkIcon } from '@/components/icons/festo-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { YouTubePlayer } from './youtube-player';
import { ChapterList } from './chapter-list';
import { formatDuration } from '@/types/search';
import type { OfficialStatus } from '@/types/search';

interface VideoData {
  videoYoutubeId: string;
  videoTitle: string;
  videoDescription: string | null;
  videoDurationSeconds: number | null;
  videoHasTranscript: boolean;
  channelName: string;
  channelOfficialStatus: OfficialStatus;
}

interface SegmentData {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
}

interface VideoDetailClientProps {
  video: VideoData;
  segments: SegmentData[];
  initialSegmentId: string | null;
  lang: string;
  labels: {
    back: string;
    official: string;
    community: string;
    openOnYouTube: string;
    videoDuration: string;
    noTranscriptNotice: string;
    chapters: string;
    segmentCount: string;
    noChapters: string;
  };
}

export function VideoDetailClient({
  video,
  segments,
  initialSegmentId,
  lang,
  labels,
}: VideoDetailClientProps) {
  const router = useRouter();

  const initialSegment = initialSegmentId
    ? segments.find((s) => s.id === initialSegmentId) ?? segments[0] ?? null
    : segments[0] ?? null;

  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(
    initialSegment?.id ?? null
  );
  const [playerStartTime, setPlayerStartTime] = useState<number>(
    initialSegment?.start_time ?? 0
  );

  const handleChapterClick = useCallback(
    (segment: SegmentData) => {
      setActiveSegmentId(segment.id);
      setPlayerStartTime(segment.start_time);

      // Update URL for deep-linking without navigation
      const url = new URL(window.location.href);
      url.searchParams.set('segment', segment.id);
      url.searchParams.set('lang', lang);
      window.history.replaceState(null, '', url.toString());
    },
    [lang]
  );

  const isOfficial = video.channelOfficialStatus === 'official';
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoYoutubeId}${playerStartTime ? `&t=${playerStartTime}s` : ''}`;

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeftIcon size={16} className="mr-2" />
          {labels.back}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-8">
      {/* Video player and info - 2 columns */}
      <div className="col-span-2 space-y-6">
        {/* Video Player */}
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <YouTubePlayer
            videoId={video.videoYoutubeId}
            startTime={playerStartTime}
            className="w-full h-full"
          />
        </div>

        {/* Video Info */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">{video.videoTitle}</h1>

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{video.channelName}</span>
            <Badge variant={isOfficial ? 'default' : 'secondary'}>
              {isOfficial ? labels.official : labels.community}
            </Badge>
          </div>

          {/* No transcript notice */}
          {!video.videoHasTranscript && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
              {labels.noTranscriptNotice}
            </p>
          )}

          {/* Video duration */}
          {video.videoDurationSeconds && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{labels.videoDuration}:</span>{' '}
              {formatDuration(video.videoDurationSeconds)}
            </div>
          )}

          {/* Open on YouTube button */}
          <Button asChild variant="outline">
            <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon size={16} className="mr-2" />
              {labels.openOnYouTube}
            </a>
          </Button>

          {/* Video description */}
          {video.videoDescription && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {video.videoDescription}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chapter list - 1 column */}
      <div className="col-span-1 border rounded-lg overflow-hidden">
        <ChapterList
          segments={segments}
          activeSegmentId={activeSegmentId}
          onChapterClick={handleChapterClick}
          labels={{
            chapters: labels.chapters,
            segmentCount: labels.segmentCount,
            noChapters: labels.noChapters,
          }}
        />
      </div>
    </div>
    </div>
  );
}
