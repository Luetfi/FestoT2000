'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { YouTubePlayer } from './youtube-player';
import type { SearchResultSegment } from '@/types/search';
import { formatTimeRange, formatDuration } from '@/types/search';

interface VideoPreviewProps {
  segment: SearchResultSegment | null;
  labels: {
    official: string;
    community: string;
    openOnYouTube: string;
    segmentDuration: string;
    videoDuration: string;
    noTranscriptNotice: string;
  };
}

export function VideoPreview({ segment, labels }: VideoPreviewProps) {
  if (!segment) {
    return (
      <aside className="w-[420px] border-l bg-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Select a result to preview
        </p>
      </aside>
    );
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${segment.video_youtube_id}&t=${segment.start_time}s`;
  const isOfficial = segment.channel_official_status === 'official';
  const timeRange = formatTimeRange(segment.start_time, segment.end_time);

  return (
    <aside className="w-[420px] border-l bg-background overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Video Player */}
        <YouTubePlayer
          videoId={segment.video_youtube_id}
          startTime={segment.start_time}
        />

        {/* No transcript notice */}
        {!segment.video_has_transcript && (
          <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            {labels.noTranscriptNotice}
          </p>
        )}

        {/* Video Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg leading-tight">
            {segment.video_title}
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {segment.channel_name}
            </span>
            <Badge variant={isOfficial ? 'default' : 'secondary'} className="text-xs">
              {isOfficial ? labels.official : labels.community}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-medium">{labels.segmentDuration}:</span> {timeRange}
            </span>
            {segment.video_duration_seconds && (
              <span>
                <span className="font-medium">{labels.videoDuration}:</span>{' '}
                {formatDuration(segment.video_duration_seconds)}
              </span>
            )}
          </div>
        </div>

        {/* Transcript snippet */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-sm text-muted-foreground italic">
            "{segment.text}"
          </p>
        </div>

        {/* Open on YouTube button */}
        <Button asChild variant="outline" className="w-full">
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {labels.openOnYouTube}
          </a>
        </Button>
      </div>
    </aside>
  );
}
