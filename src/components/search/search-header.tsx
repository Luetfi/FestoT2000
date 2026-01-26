import { Suspense } from 'react';
import Link from 'next/link';
import { SearchInput } from './search-input';
import { LanguageToggle } from './language-toggle';
import { FestoLogo } from '@/components/ui/festo-logo';
import type { Dictionary, Locale } from '@/lib/dictionaries/get-dictionary';

interface SearchHeaderProps {
  dict: Dictionary;
  lang: Locale;
  currentQuery: string;
}

export function SearchHeader({ dict, lang, currentQuery }: SearchHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-background border-b">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Festo Logo and App title - links to homepage */}
        <Link
          href={`/?lang=${lang}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0"
        >
          <FestoLogo className="text-2xl" />
          <span className="text-xl font-[family-name:var(--font-title)] text-foreground">
            {dict.appTitle}
          </span>
        </Link>

        {/* Search input - takes remaining space */}
        <div className="flex-1 max-w-2xl">
          <SearchInput
            placeholder={dict.searchPlaceholder}
            buttonText={dict.searchButton}
            lang={lang}
            defaultValue={currentQuery}
          />
        </div>

        {/* Language toggle */}
        <Suspense fallback={<div className="w-16 h-8 bg-muted rounded animate-pulse" />}>
          <LanguageToggle currentLang={lang} label={dict.languageToggle} />
        </Suspense>
      </div>
    </header>
  );
}
