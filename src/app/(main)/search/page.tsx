'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const [sourceFilter, setSourceFilter] = useState<'all' | 'official' | 'community'>('all');

  // Load dictionary
  useEffect(() => {
    const loadDict = async () => {
      const dictModule = await import(`@/lib/dictionaries/${lang}.json`);
      setDict(dictModule.default);
    };
    loadDict();
  }, [lang]);

  // Reset source filter when query changes
  useEffect(() => {
    setSourceFilter('all');
  }, [query]);

  // Fetch results
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`
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

  // Group segments by video
  const groupedVideos = useMemo(() => groupByVideo(results), [results]);

  // Filter by source
  const filteredVideos = useMemo(() => {
    if (sourceFilter === 'all') return groupedVideos;
    if (sourceFilter === 'official') return groupedVideos.filter(v => v.channel_official_status === 'official');
    return groupedVideos.filter(v => v.channel_official_status !== 'official');
  }, [groupedVideos, sourceFilter]);

  if (!dict) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background">
      {/* Main content area */}
      <div className="flex flex-1">
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
          <div className="flex-1 flex flex-col">
            {groupedVideos.length > 0 && (
              <div className="px-4 pt-4 flex justify-center">
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                  {([
                    { value: 'all' as const, label: dict.allSources },
                    { value: 'official' as const, label: dict.officialLabel },
                    { value: 'community' as const, label: dict.communityLabel },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSourceFilter(opt.value)}
                      className={`
                        px-3 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0 border-border
                        ${sourceFilter === opt.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                        }
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <ResultsList
              videos={filteredVideos}
              query={query}
              lang={lang}
              labels={{
                official: dict.officialLabel,
                community: dict.communityLabel,
                segmentDuration: dict.segmentDuration,
                matchingSegments: dict.matchingSegments,
                noResults: dict.noResults,
              }}
            />
          </div>
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
