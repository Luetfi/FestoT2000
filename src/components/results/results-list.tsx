import type { SearchResultSegment } from '@/types/search';
import { ResultCard } from './result-card';

interface ResultsListProps {
  segments: SearchResultSegment[];
  selectedId: string | null;
  onSelect: (segment: SearchResultSegment) => void;
  labels: {
    official: string;
    community: string;
    segmentDuration: string;
    noResults: string;
  };
}

export function ResultsList({
  segments,
  selectedId,
  onSelect,
  labels,
}: ResultsListProps) {
  if (segments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground text-lg">{labels.noResults}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {segments.map((segment) => (
        <ResultCard
          key={segment.id}
          segment={segment}
          isSelected={selectedId === segment.id}
          onClick={() => onSelect(segment)}
          labels={{
            official: labels.official,
            community: labels.community,
            segmentDuration: labels.segmentDuration,
          }}
        />
      ))}
    </div>
  );
}
