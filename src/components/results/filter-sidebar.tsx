'use client';

import { cn } from '@/lib/utils';
import { Layers, ShieldCheck, Users } from 'lucide-react';

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

const sourceConfig: Record<SourceFilter, { icon: typeof Layers }> = {
  all: { icon: Layers },
  official: { icon: ShieldCheck },
  community: { icon: Users },
};

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
    <aside className="w-[240px] border-r bg-background px-3 py-4">
      <div className="px-3 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {labels.filterBySource}
      </div>
      <div className="space-y-0.5">
        {sources.map(({ key, label, count }) => {
          const isActive = currentSource === key;
          const Icon = sourceConfig[key].icon;

          return (
            <button
              key={key}
              onClick={() => onSourceChange(key)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-4 shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
                )}
              />
              <span className="flex-1 text-left">{label}</span>
              <span
                className={cn(
                  'min-w-[28px] rounded-full px-2 py-0.5 text-center text-xs font-medium tabular-nums transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export type { SourceFilter };
