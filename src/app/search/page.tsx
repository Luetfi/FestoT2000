'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { FilterSidebar, type SourceFilter } from '@/components/results/filter-sidebar';
import { ResultsList } from '@/components/results/results-list';
import type { SearchResultSegment } from '@/types/search';
import type { GroupedVideoResult } from '@/components/results/video-result-card';
import type { Dictionary, Locale } from '@/lib/dictionaries/get-dictionary';

function groupByVideo(segments: SearchResultSegment[]): GroupedVideoResult[] {
  const map = new Map<string, GroupedVideoResult>();
  for (const seg of segments) {
    const existing = map.get(seg.video_id);
    if (existing) {
      existing.matchCount++;
    } else {
      map.set(seg.video_id, {
        video_id: seg.video_id,
        video_youtube_id: seg.video_youtube_id,
        video_title: seg.video_title,
        video_thumbnail_url: seg.video_thumbnail_url,
        video_duration_seconds: seg.video_duration_seconds,
        channel_name: seg.channel_name,
        channel_official_status: seg.channel_official_status,
        bestSegment: seg,
        matchCount: 1,
      });
    }
  }
  return Array.from(map.values());
}

// Inner component that uses useSearchParams
function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const langParam = searchParams.get('lang');
  const lang: Locale = langParam === 'en' ? 'en' : 'de';

  const [dict, setDict] = useState<Dictionary | null>(null);
  const [results, setResults] = useState<SearchResultSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Load dictionary
  useEffect(() => {
    const loadDict = async () => {
      const dictModule = await import(`@/lib/dictionaries/${lang}.json`);
      setDict(dictModule.default);
    };
    loadDict();
  }, [lang]);

  // Fetch ALL results (no source filter in API call - filter client-side only)
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&source=all`
        );
        const data = await response.json();
        if (!response.ok || !data.results) {
          const errorMessage = data.error || 'Unknown error';
          console.error('Search API error:', errorMessage);
          setError(errorMessage);
          setResults([]);
          return;
        }
        setResults(data.results as SearchResultSegment[]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Network error';
        console.error('Search failed:', errorMessage);
        setError(errorMessage);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  // Filter results based on source (client-side only)
  const filteredResults =
    sourceFilter === 'all'
      ? results
      : results.filter((r) => r.channel_official_status === sourceFilter);

  // Group filtered segments by video
  const groupedVideos = useMemo(() => groupByVideo(filteredResults), [filteredResults]);

  // Count unique videos per source for the filter sidebar
  const resultCounts = useMemo(() => {
    const allVideos = groupByVideo(results);
    return {
      all: allVideos.length,
      official: allVideos.filter((v) => v.channel_official_status === 'official').length,
      community: allVideos.filter((v) => v.channel_official_status === 'community').length,
    };
  }, [results]);

  if (!dict) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <FilterSidebar
          currentSource={sourceFilter}
          onSourceChange={setSourceFilter}
          labels={{
            filterBySource: dict.filterBySource,
            sourceAll: dict.sourceAll,
            sourceOfficial: dict.sourceOfficial,
            sourceCommunity: dict.sourceCommunity,
          }}
          resultCounts={resultCounts}
        />

        {/* Results list */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              {lang === 'de' ? 'Suche läuft...' : 'Searching...'}
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8 max-w-md">
              <p className="text-destructive font-medium mb-2">
                {lang === 'de' ? 'Fehler bei der Suche' : 'Search error'}
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : (
          <ResultsList
            videos={groupedVideos}
            lang={lang}
            labels={{
              official: dict.officialLabel,
              community: dict.communityLabel,
              segmentDuration: dict.segmentDuration,
              matchingSegments: dict.matchingSegments,
              noResults: dict.noResults,
            }}
          />
        )}
      </div>
    </div>
  );
}

// Wrapper component with Suspense boundary
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
