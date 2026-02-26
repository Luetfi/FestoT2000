'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchInput } from '@/components/search/search-input';
import { VideoCard, type VideoCardData } from '@/components/home/video-card';

const dictionaries = {
  de: () => import('@/lib/dictionaries/de.json').then((m) => m.default),
  en: () => import('@/lib/dictionaries/en.json').then((m) => m.default),
};

type Locale = keyof typeof dictionaries;

function isValidLocale(v: string | null): v is Locale {
  return v === 'de' || v === 'en';
}

const MAX_RECENT = 6;

export function HomeContent() {
  const searchParams = useSearchParams();
  const lang: Locale = isValidLocale(searchParams.get('lang')) ? (searchParams.get('lang') as Locale) : 'de';

  const [dict, setDict] = useState<Awaited<ReturnType<typeof dictionaries.de>> | null>(null);
  const [videos, setVideos] = useState<VideoCardData[]>([]);

  useEffect(() => {
    dictionaries[lang]().then(setDict);
  }, [lang]);

  useEffect(() => {
    fetch('/api/videos')
      .then((r) => r.json())
      .then((data) => setVideos((data.videos || []).slice(0, MAX_RECENT)))
      .catch(() => setVideos([]));
  }, []);

  if (!dict) return null;

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
          />
        </div>
      </div>

      {/* Recent videos */}
      {videos.length > 0 && (
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
      )}
    </main>
  );
}
