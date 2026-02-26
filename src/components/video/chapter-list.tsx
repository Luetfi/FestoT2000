'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn, trimToSentenceStart } from '@/lib/utils';
import { formatDuration, formatTimeRange } from '@/types/search';

interface ChapterSegment {
  id: string;
  text: string;
  summary: string | null;
  start_time: number;
  end_time: number;
}

interface ChapterListProps {
  segments: ChapterSegment[];
  activeSegmentId: string | null;
  onChapterClick: (segment: ChapterSegment) => void;
  labels: {
    allChapters: string;
    segmentCount: string;
    noChapters: string;
  };
}

export function ChapterList({
  segments,
  activeSegmentId,
  onChapterClick,
  labels,
}: ChapterListProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(
    (segment: ChapterSegment) => {
      onChapterClick(segment);
    },
    [onChapterClick]
  );

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSegmentId]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">{labels.allChapters}</h2>
        <Badge variant="secondary" className="text-xs">
          {segments.length} {labels.segmentCount}
        </Badge>
      </div>

      {/* Chapter grid */}
      {segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.noChapters}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {segments.map((segment) => {
            const isActive = segment.id === activeSegmentId;
            return (
              <button
                key={segment.id}
                ref={isActive ? activeRef : null}
                onClick={() => handleClick(segment)}
                className={cn(
                  'rounded-lg p-3 text-left transition-colors',
                  isActive
                    ? 'ring-2 ring-primary bg-accent/30'
                    : 'hover:bg-accent/50 bg-muted/30'
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-mono font-medium tabular-nums">
                    {formatDuration(segment.start_time)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm line-clamp-2">
                      {segment.summary || trimToSentenceStart(segment.text)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeRange(segment.start_time, segment.end_time)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
