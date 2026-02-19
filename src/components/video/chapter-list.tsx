'use client';

import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn, trimToSentenceStart } from '@/lib/utils';
import { formatDuration, formatTimeRange } from '@/types/search';

interface ChapterSegment {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
}

interface ChapterListProps {
  segments: ChapterSegment[];
  activeSegmentId: string | null;
  onChapterClick: (segment: ChapterSegment) => void;
  labels: {
    chapters: string;
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

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSegmentId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">{labels.chapters}</h2>
        <Badge variant="secondary" className="text-xs">
          {segments.length} {labels.segmentCount}
        </Badge>
      </div>

      {/* Chapter list */}
      {segments.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">{labels.noChapters}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {segments.map((segment) => {
            const isActive = segment.id === activeSegmentId;
            return (
              <button
                key={segment.id}
                ref={isActive ? activeRef : null}
                onClick={() => onChapterClick(segment)}
                className={cn(
                  'w-full text-left rounded-lg p-3 transition-colors',
                  isActive
                    ? 'ring-2 ring-primary bg-accent/30'
                    : 'hover:bg-accent/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-mono font-medium tabular-nums">
                    {formatDuration(segment.start_time)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm line-clamp-2">{trimToSentenceStart(segment.text)}</p>
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
