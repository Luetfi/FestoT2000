'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchInput } from '@/components/search/search-input';
import { VideoCard, type VideoCardData } from '@/components/home/video-card';
import { ResultsList } from '@/components/results/results-list';
import type { SearchResultSegment } from '@/types/search';
import type { GroupedVideoResult } from '@/components/results/video-result-card';

const dictionaries = {
  de: () => import('@/lib/dictionaries/de.json').then((m) => m.default),
  en: () => import('@/lib/dictionaries/en.json').then((m) => m.default),
};

type Locale = keyof typeof dictionaries;

function isValidLocale(v: string | null): v is Locale {
  return v === 'de' || v === 'en';
}

function groupByVideo(segments: SearchResultSegment[]): GroupedVideoResult[] {
  const map = new Map<string, GroupedVideoResult>();
  for (const seg of segments) {
    const existing = map.get(seg.video_id);
    if (existing) {
      existing.matchCount++;
      if (seg.similarity > existing.bestSegment.similarity) {
        existing.bestSegment = seg;
      }
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

const MAX_RECENT = 6;

export function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lang: Locale = isValidLocale(searchParams.get('lang')) ? (searchParams.get('lang') as Locale) : 'de';
  const query = searchParams.get('q') || '';

  const [dict, setDict] = useState<Awaited<ReturnType<typeof dictionaries.de>> | null>(null);
  const [videos, setVideos] = useState<VideoCardData[]>([]);

  // Search state
  const [results, setResults] = useState<SearchResultSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'official' | 'community'>('all');

  useEffect(() => {
    dictionaries[lang]().then(setDict);
  }, [lang]);

  // Fetch recent videos (only when no search query)
  useEffect(() => {
    if (query) return;
    fetch('/api/videos')
      .then((r) => r.json())
      .then((data) => setVideos((data.videos || []).slice(0, MAX_RECENT)))
      .catch(() => setVideos([]));
  }, [query]);

  // Reset source filter when query changes
  useEffect(() => {
    setSourceFilter('all');
  }, [query]);

  // Fetch search results when query is present
  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

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

  const handleResetSearch = () => {
    router.push(`/?lang=${lang}`);
  };

  if (!dict) return null;

  const isSearching = !!query;

  return (
    <main className="min-h-screen bg-background px-4 sm:px-8 pb-12">
      <div className="mx-auto max-w-3xl pt-16 pb-12 text-center space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {dict.heroTitle}
        </h1>
        <p className="text-muted-foreground text-lg">
          {dict.heroSubtitle}
        </p>

        <div className="pt-4">
          <SearchInput
            placeholder={dict.searchPlaceholder}
            buttonText={dict.searchButton}
            minLengthHint={dict.searchMinLength}
            lang={lang}
            defaultValue={query}
            key={query}
          />
        </div>
      </div>

      {isSearching ? (
        /* Search results */
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-pulse text-muted-foreground">
                {lang === 'de' ? 'Suche läuft...' : 'Searching...'}
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center p-8 max-w-md">
                <p className="text-destructive font-medium mb-2">
                  {lang === 'de' ? 'Fehler bei der Suche' : 'Search error'}
                </p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Source filter + reset button */}
              <div className="flex items-center justify-center gap-4 mb-4">
                {groupedVideos.length > 0 && (
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
                )}
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  {dict.resetSearch}
                </button>
              </div>

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
            </>
          )}
        </div>
      ) : (
        /* Recent videos */
        videos.length > 0 && (
          <div className="mx-auto max-w-6xl">
            <h2 className="text-lg font-semibold text-foreground mb-4">{dict.recentVideos}</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  lang={lang}
                  labels={{
                    official: dict.officialLabel,
                    community: dict.communityLabel,
                  }}
                />
              ))}
            </div>
          </div>
        )
      )}
    </main>
  );
}
