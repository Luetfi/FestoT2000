import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { SearchResultSegment, RelevanceLevel } from '@/types/search';
import { formatTimeRange, formatDuration, getRelevanceLevel } from '@/types/search';
import { cn } from '@/lib/utils';

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
    relevanceHigh: string;
    relevanceMedium: string;
    relevanceLow: string;
    relevanceSuffix: string;
  };
}

const RELEVANCE_DOT: Record<RelevanceLevel, string> = {
  high: 'bg-green-500',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground',
};

const RELEVANCE_TEXT: Record<RelevanceLevel, string> = {
  high: 'text-green-600 dark:text-green-500',
  medium: 'text-amber-600 dark:text-amber-500',
  low: 'text-muted-foreground',
};

export function VideoResultCard({ video, query, lang, labels }: VideoResultCardProps) {
  const isOfficial = video.channel_official_status === 'official';
  const timeRange = formatTimeRange(video.bestSegment.start_time, video.bestSegment.end_time);
  const href = `/video/${video.video_id}?lang=${lang}&segment=${video.bestSegment.id}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  const summary = video.bestSegment.summary;

  const confidence = video.bestSegment.confidence ?? video.bestSegment.semantic_similarity * 100;
  const { level, percent } = getRelevanceLevel(confidence);
  const relevanceLabel =
    level === 'high'
      ? labels.relevanceHigh
      : level === 'medium'
        ? labels.relevanceMedium
        : labels.relevanceLow;

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
              <span
                className={cn('flex items-center gap-1 font-medium', RELEVANCE_TEXT[level])}
                title={relevanceLabel}
              >
                <span className={cn('size-2 rounded-full', RELEVANCE_DOT[level])} />
                {percent}% {labels.relevanceSuffix}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
