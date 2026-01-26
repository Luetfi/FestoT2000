import { Suspense } from 'react';
import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries/get-dictionary';
import { SearchInput } from '@/components/search/search-input';
import { QuickFilters } from '@/components/search/quick-filters';
import { LanguageToggle } from '@/components/search/language-toggle';
import { FestoLogo } from '@/components/ui/festo-logo';

interface HomePageProps {
  searchParams: Promise<{ lang?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const lang = isValidLocale(params.lang) ? params.lang : defaultLocale;
  const dict = await getDictionary(lang);

  const quickFilters = [
    { id: 'error-code', label: dict.filterErrorCode, query: 'Fehlercode' },
    { id: 'commissioning', label: dict.filterCommissioning, query: 'Inbetriebnahme' },
    { id: 'how-to', label: dict.filterHowTo, query: 'How-to' },
    { id: 'interfaces', label: dict.filterInterfaces, query: 'Schnittstellen' },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-8">
      <div className="w-full max-w-3xl space-y-8">
        {/* Header with Festo logo, title and language toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FestoLogo className="text-5xl" />
            <h1 className="text-4xl font-[family-name:var(--font-title)] tracking-tight text-foreground">
              {dict.appTitle}
            </h1>
          </div>
          <Suspense fallback={<div className="w-16 h-8 bg-muted rounded animate-pulse" />}>
            <LanguageToggle currentLang={lang} label={dict.languageToggle} />
          </Suspense>
        </div>

        {/* Search input */}
        <SearchInput
          placeholder={dict.searchPlaceholder}
          buttonText={dict.searchButton}
          lang={lang}
        />

        {/* Quick filter chips */}
        <QuickFilters filters={quickFilters} lang={lang} />

        {/* Subtle helper text */}
        <p className="text-center text-sm text-muted-foreground">
          {lang === 'de'
            ? 'Geben Sie ein Problem, einen Fehlercode oder eine Produktbezeichnung ein'
            : 'Enter a problem, error code, or product name'}
        </p>
      </div>
    </main>
  );
}
