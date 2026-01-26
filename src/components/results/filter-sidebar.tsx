'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SourceFilter = 'all' | 'official' | 'community';

interface FilterSidebarProps {
  currentSource: SourceFilter;
  onSourceChange: (source: SourceFilter) => void;
  labels: {
    filterBySource: string;
    sourceAll: string;
    sourceOfficial: string;
    sourceCommunity: string;
  };
  resultCounts: {
    all: number;
    official: number;
    community: number;
  };
}

export function FilterSidebar({
  currentSource,
  onSourceChange,
  labels,
  resultCounts,
}: FilterSidebarProps) {
  const sources: { key: SourceFilter; label: string; count: number }[] = [
    { key: 'all', label: labels.sourceAll, count: resultCounts.all },
    { key: 'official', label: labels.sourceOfficial, count: resultCounts.official },
    { key: 'community', label: labels.sourceCommunity, count: resultCounts.community },
  ];

  return (
    <aside className="w-[240px] border-r bg-background p-4 space-y-4">
      <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
        {labels.filterBySource}
      </h2>
      <div className="space-y-1">
        {sources.map(({ key, label, count }) => (
          <Button
            key={key}
            variant={currentSource === key ? 'secondary' : 'ghost'}
            className={cn(
              'w-full justify-between',
              currentSource === key && 'bg-secondary'
            )}
            onClick={() => onSourceChange(key)}
          >
            <span>{label}</span>
            <span className="text-muted-foreground text-xs">({count})</span>
          </Button>
        ))}
      </div>
    </aside>
  );
}

export type { SourceFilter };
