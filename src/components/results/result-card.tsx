import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SearchResultSegment } from '@/types/search';
import { formatTimeRange } from '@/types/search';
import { cn } from '@/lib/utils';

interface ResultCardProps {
  segment: SearchResultSegment;
  isSelected: boolean;
  onClick: () => void;
  query: string;
  lang: string;
  labels: {
    official: string;
    community: string;
    segmentDuration: string;
  };
}

export function ResultCard({
  segment,
  isSelected,
  onClick,
  query,
  lang,
  labels,
}: ResultCardProps) {
  const isOfficial = segment.channel_official_status === 'official';
  const timeRange = formatTimeRange(segment.start_time, segment.end_time);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/50',
        isSelected && 'ring-2 ring-primary bg-accent/30'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
            {segment.video_title}
          </CardTitle>
          <Badge
            variant={isOfficial ? 'default' : 'secondary'}
            className="shrink-0"
          >
            {isOfficial ? labels.official : labels.community}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          {segment.channel_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
          {segment.text}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="font-medium">{labels.segmentDuration}:</span>
              {timeRange}
            </span>
          </div>
          <Link
            href={`/video/${segment.video_id}?lang=${lang}&segment=${segment.id}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
