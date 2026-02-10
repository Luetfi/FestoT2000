'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchInput } from '@/components/search/search-input';
import { FilterSidebar, type SourceFilter } from '@/components/results/filter-sidebar';
import { ResultsList } from '@/components/results/results-list';
import { VideoPreview } from '@/components/video/video-preview';
import type { SearchResultSegment } from '@/types/search';
import type { Dictionary, Locale } from '@/lib/dictionaries/get-dictionary';

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
  const [selectedSegment, setSelectedSegment] = useState<SearchResultSegment | null>(null);

  // Load dictionary
  useEffect(() => {
    const loadDict = async () => {
      const dictModule = await import(`@/lib/dictionaries/${lang}.json`);
      setDict(dictModule.default);
    };
    loadDict();
  }, [lang]);

  // Fetch ALL results (no source filter in API call - filter client-side only)
  // This ensures correct counts for all sources in the sidebar
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        // Always fetch ALL results - source filtering is client-side only
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&source=all`
        );
        const data = await response.json();
        // Handle error responses (API returns { error: string } on failure)
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
  }, [query]); // Note: sourceFilter NOT in deps - we fetch all, filter client-side

  // Calculate counts for filter sidebar (from ALL results)
  const resultCounts = {
    all: results.length,
    official: results.filter((r) => r.channel_official_status === 'official').length,
    community: results.filter((r) => r.channel_official_status === 'community').length,
  };

  // Filter results based on source (client-side only)
  const filteredResults =
    sourceFilter === 'all'
      ? results
      : results.filter((r) => r.channel_official_status === sourceFilter);

  // Reset selection when filtered results change
  useEffect(() => {
    if (filteredResults.length > 0) {
      setSelectedSegment(filteredResults[0]);
    } else {
      setSelectedSegment(null);
    }
  }, [sourceFilter, results]);

  if (!dict) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Search bar */}
      <div className="border-b px-4 py-3">
        <div className="max-w-2xl">
          <SearchInput
            placeholder={dict.searchPlaceholder}
            buttonText={dict.searchButton}
            lang={lang}
            defaultValue={query}
          />
        </div>
      </div>

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
            segments={filteredResults}
            selectedId={selectedSegment?.id || null}
            onSelect={setSelectedSegment}
            labels={{
              official: dict.officialLabel,
              community: dict.communityLabel,
              segmentDuration: dict.segmentDuration,
              noResults: dict.noResults,
            }}
          />
        )}

        {/* Video preview panel */}
        <VideoPreview
          segment={selectedSegment}
          labels={{
            official: dict.officialLabel,
            community: dict.communityLabel,
            openOnYouTube: dict.openOnYouTube,
            segmentDuration: dict.segmentDuration,
            videoDuration: dict.videoDuration,
            noTranscriptNotice: dict.noTranscriptNotice,
          }}
        />
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
