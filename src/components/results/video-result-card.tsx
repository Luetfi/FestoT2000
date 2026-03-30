import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { SearchResultSegment } from '@/types/search';
import { formatTimeRange, formatDuration } from '@/types/search';

export interface GroupedVideoResult {
  video_id: string;
  video_youtube_id: string;
  video_title: string;
  video_thumbnail_url: string;
  video_duration_seconds: number | null;
  channel_name: string;
  channel_official_status: SearchResultSegment['channel_official_status'];
  bestSegment: SearchResultSegment;
  allSegments: SearchResultSegment[];
  matchCount: number;
}

interface VideoResultCardProps {
  video: GroupedVideoResult;
  query: string;
  lang: string;
  labels: {
    official: string;
    community: string;
    segmentDuration: string;
    matchingSegments: string;
  };
}

export function VideoResultCard({ video, query, lang, labels }: VideoResultCardProps) {
  const isOfficial = video.channel_official_status === 'official';
  const timeRange = formatTimeRange(video.bestSegment.start_time, video.bestSegment.end_time);
  const href = `/video/${video.video_id}?lang=${lang}&segment=${video.bestSegment.id}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  const summary = video.bestSegment.summary;

  return (
    <div className="rounded-lg border bg-card transition-colors hover:bg-accent/50">
      <Link href={href} className="block group">
        <div className="flex gap-4 p-3">
          {/* Thumbnail */}
          <div className="relative shrink-0 w-[180px] aspect-video rounded-md overflow-hidden bg-muted">
            <Image
              src={video.video_thumbnail_url}
              alt={video.video_title}
              fill
              className="object-cover"
              sizes="180px"
            />
            {video.video_duration_seconds != null && (
              <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {formatDuration(video.video_duration_seconds)}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {video.video_title}
              </h3>
              <Badge
                variant={isOfficial ? 'default' : 'secondary'}
                className="shrink-0 text-xs"
              >
                {isOfficial ? labels.official : labels.community}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mt-0.5">
              {video.channel_name}
            </p>

            {summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                {summary}
              </p>
            )}

            <div className="flex items-center gap-3 mt-auto pt-2 text-xs text-muted-foreground">
              <span>
                <span className="font-medium">{labels.segmentDuration}:</span> {timeRange}
              </span>
              {video.matchCount > 1 && (
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                  {video.matchCount} {labels.matchingSegments}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
