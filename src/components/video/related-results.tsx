'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SearchResultSegment } from '@/types/search';
import { formatTimeRange } from '@/types/search';

interface RelatedResultsProps {
  currentSegmentId: string;
  segments: SearchResultSegment[];
  query: string;
  lang: string;
  labels: {
    official: string;
    community: string;
    relatedVideos: string;
  };
  maxResults?: number;
}

export function RelatedResults({
  currentSegmentId,
  segments,
  query,
  lang,
  labels,
  maxResults = 5,
}: RelatedResultsProps) {
  // Filter out current segment and limit results
  const relatedSegments = segments
    .filter((s) => s.id !== currentSegmentId)
    .slice(0, maxResults);

  if (relatedSegments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{labels.relatedVideos}</h2>
      <div className="space-y-3">
        {relatedSegments.map((segment) => {
          const isOfficial = segment.channel_official_status === 'official';
          const timeRange = formatTimeRange(segment.start_time, segment.end_time);

          return (
            <Link
              key={segment.id}
              href={`/video/${segment.video_id}?lang=${lang}&segment=${segment.id}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
              className="block"
            >
              <Card className="hover:bg-accent/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-32 h-20 bg-muted rounded overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={segment.video_thumbnail_url}
                        alt={segment.video_title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback for broken images
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">
                        {segment.video_title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{segment.channel_name}</span>
                        <Badge
                          variant={isOfficial ? 'default' : 'secondary'}
                          className="text-xs py-0"
                        >
                          {isOfficial ? labels.official : labels.community}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {timeRange}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
