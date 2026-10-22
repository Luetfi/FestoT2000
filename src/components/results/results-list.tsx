import { VideoResultCard, type GroupedVideoResult } from './video-result-card';

interface ResultsListProps {
  videos: GroupedVideoResult[];
  query: string;
  lang: string;
  labels: {
    official: string;
    community: string;
    segmentDuration: string;
    matchingSegments: string;
    noResults: string;
    relevanceHigh: string;
    relevanceMedium: string;
    relevanceLow: string;
    relevanceSuffix: string;
  };
}

export function ResultsList({ videos, query, lang, labels }: ResultsListProps) {
  if (videos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground text-lg">{labels.noResults}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {videos.map((video) => (
        <VideoResultCard
          key={video.video_id}
          video={video}
          query={query}
          lang={lang}
          labels={{
            official: labels.official,
            community: labels.community,
            segmentDuration: labels.segmentDuration,
            matchingSegments: labels.matchingSegments,
            relevanceHigh: labels.relevanceHigh,
            relevanceMedium: labels.relevanceMedium,
            relevanceLow: labels.relevanceLow,
            relevanceSuffix: labels.relevanceSuffix,
          }}
        />
      ))}
    </div>
  );
}
