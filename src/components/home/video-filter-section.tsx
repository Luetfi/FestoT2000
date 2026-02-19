'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { VideoCard, type VideoCardData } from './video-card';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/search/query-parser';
import { CategoryIcon } from '@/components/icons/festo-icons';
import type { OfficialStatus } from '@/types/search';

type SourceFilter = 'all' | 'official' | 'community';

/* ─── Topic definitions with matching keywords ─── */
interface TopicFilter {
  id: string;
  keywords: string[];
}

const TOPIC_FILTERS: TopicFilter[] = [
  {
    id: 'error-code',
    keywords: ['fehler', 'error', 'fehlercode', 'error code', 'diagnostic', 'diagnose', 'E-'],
  },
  {
    id: 'commissioning',
    keywords: ['inbetriebnahme', 'commissioning', 'setup', 'konfiguration', 'configuration', 'parametr'],
  },
  {
    id: 'how-to',
    keywords: ['how to', 'how-to', 'anleitung', 'tutorial', 'guide', 'schritt', 'step'],
  },
  {
    id: 'interfaces',
    keywords: ['schnittstelle', 'interface', 'profinet', 'ethernet', 'io-link', 'modbus', 'opc', 'easyip'],
  },
];

interface VideoFilterSectionProps {
  lang: string;
  labels: {
    browseVideos: string;
    filterByProduct: string;
    allProducts: string;
    allSources: string;
    official: string;
    community: string;
    noVideosFound: string;
    videosCount: string;
    activeFilters: string;
    clearAllFilters: string;
  };
  topicLabels: { id: string; label: string }[];
}

/* ─── Reusable multi-select category dropdown ─── */
function CategoryDropdown({
  label,
  categories,
  selected,
  onToggle,
  allLabel,
}: {
  label: string;
  categories: ProductCategory[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCategory = selected.size === 1
    ? categories.find((c) => c.id === Array.from(selected)[0])
    : null;

  const displayText = selected.size === 0
    ? allLabel
    : selected.size === 1 && selectedCategory
      ? selectedCategory.label
      : `${selected.size} Kategorien`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors
          ${selected.size > 0
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border bg-background text-foreground hover:bg-muted'
          }
        `}
      >
        <span className="truncate max-w-[220px]">{displayText}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[280px] max-h-[360px] overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          <button
            type="button"
            onClick={() => {
              if (selected.size > 0) {
                Array.from(selected).forEach(onToggle);
              }
            }}
            className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted border-b border-border"
          >
            {allLabel}
          </button>

          {categories.map((cat) => {
            const isSelected = selected.has(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onToggle(cat.id)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors
                  ${isSelected ? 'bg-primary/5 text-primary font-medium' : 'text-foreground hover:bg-muted'}
                `}
              >
                <span
                  className={`
                    flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors
                    ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}
                  `}
                >
                  {isSelected && (
                    <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <CategoryIcon categoryId={cat.id} size={18} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VideoFilterSection({ lang, labels, topicLabels }: VideoFilterSectionProps) {
  const [videos, setVideos] = useState<VideoCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/videos')
      .then((res) => res.json())
      .then((data) => {
        setVideos(data.videos || []);
      })
      .catch((err) => {
        console.error('Failed to load videos:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const hasActiveFilters =
    selectedCategories.size > 0 || sourceFilter !== 'all' || selectedTopic !== null;

  const clearAllFilters = () => {
    setSelectedCategories(new Set());
    setSourceFilter('all');
    setSelectedTopic(null);
  };

  const filteredVideos = useMemo(() => {
    // Collect all keywords from selected categories
    const activeKeywords = selectedCategories.size > 0
      ? PRODUCT_CATEGORIES
          .filter((c) => selectedCategories.has(c.id))
          .flatMap((c) => c.keywords)
      : [];

    return videos.filter((video) => {
      // Topic filter
      if (selectedTopic) {
        const topic = TOPIC_FILTERS.find((t) => t.id === selectedTopic);
        if (topic) {
          const searchText = `${video.title} ${video.description || ''}`.toLowerCase();
          const matchesTopic = topic.keywords.some((kw) =>
            searchText.includes(kw.toLowerCase())
          );
          if (!matchesTopic) return false;
        }
      }

      // Category filter — match any keyword from any selected category
      if (activeKeywords.length > 0) {
        const searchText = `${video.title} ${video.description || ''}`.toLowerCase();
        const matchesCategory = activeKeywords.some((kw) =>
          searchText.includes(kw.toLowerCase())
        );
        if (!matchesCategory) return false;
      }

      // Source filter
      if (sourceFilter !== 'all' && video.channel_official_status !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [videos, selectedCategories, sourceFilter, selectedTopic]);

  const sourceOptions: { value: SourceFilter; label: string }[] = [
    { value: 'all', label: labels.allSources },
    { value: 'official', label: labels.official },
    { value: 'community', label: labels.community },
  ];

  return (
    <section className="w-full space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">{labels.browseVideos}</h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Topic chips */}
      <div className="flex flex-wrap items-center gap-2">
        {topicLabels.map((topic) => (
          <Badge
            key={topic.id}
            variant={selectedTopic === topic.id ? 'default' : 'secondary'}
            className="cursor-pointer px-3 py-1.5 text-sm transition-colors"
            onClick={() => setSelectedTopic(selectedTopic === topic.id ? null : topic.id)}
          >
            {topic.label}
          </Badge>
        ))}
      </div>

      {/* Compact filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Product category dropdown */}
        <CategoryDropdown
          label={labels.filterByProduct}
          categories={PRODUCT_CATEGORIES}
          selected={selectedCategories}
          onToggle={toggleCategory}
          allLabel={labels.allProducts}
        />

        {/* Vertical divider */}
        <div className="h-6 w-px bg-border" />

        {/* Source toggle buttons */}
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {sourceOptions.map((opt) => (
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

        {/* Clear all button (only when filters active) */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
            {labels.clearAllFilters}
          </button>
        )}
      </div>

      {/* Active filters chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {labels.activeFilters}:
          </span>

          {selectedTopic && (
            <Badge
              variant="default"
              className="cursor-pointer gap-1 px-2 py-0.5 text-xs"
              onClick={() => setSelectedTopic(null)}
            >
              {topicLabels.find((t) => t.id === selectedTopic)?.label ?? selectedTopic}
              <span className="ml-0.5 text-[10px] opacity-70">&times;</span>
            </Badge>
          )}

          {Array.from(selectedCategories).map((catId) => {
            const cat = PRODUCT_CATEGORIES.find((c) => c.id === catId);
            return (
              <Badge
                key={`active-c-${catId}`}
                variant="default"
                className="cursor-pointer gap-1 px-2 py-0.5 text-xs"
                onClick={() => toggleCategory(catId)}
              >
                {cat?.label ?? catId}
                <span className="ml-0.5 text-[10px] opacity-70">&times;</span>
              </Badge>
            );
          })}

          {sourceFilter !== 'all' && (
            <Badge
              variant="default"
              className="cursor-pointer gap-1 px-2 py-0.5 text-xs"
              onClick={() => setSourceFilter('all')}
            >
              {sourceFilter === 'official' ? labels.official : labels.community}
              <span className="ml-0.5 text-[10px] opacity-70">&times;</span>
            </Badge>
          )}
        </div>
      )}

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-muted-foreground">
          {filteredVideos.length} {labels.videosCount}
        </p>
      )}

      {/* Video grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card animate-pulse">
              <div className="aspect-video bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">{labels.noVideosFound}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              lang={lang}
              labels={{
                official: labels.official,
                community: labels.community,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
