'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FestoLogo } from '@/components/ui/festo-logo';
import { SearchInput } from '@/components/search/search-input';
import type { Dictionary, Locale } from '@/lib/dictionaries/get-dictionary';

export function FestoHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();

  const langParam = searchParams.get('lang');
  const lang: Locale = langParam === 'en' ? 'en' : 'de';
  const currentQuery = searchParams.get('q') || '';
  const isHome = pathname === '/';

  const [dict, setDict] = useState<Dictionary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadDict = async () => {
      const dictModule = await import(`@/lib/dictionaries/${lang}.json`);
      setDict(dictModule.default);
    };
    loadDict();
  }, [lang]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setLanguage = (newLang: Locale) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('lang', newLang);
    router.push(`${pathname}?${params.toString()}`);
    setSettingsOpen(false);
  };

  const handleSettingsClick = () => {
    setSettingsOpen(!settingsOpen);
  };

  if (!dict) {
    return (
      <header className="sticky top-0 z-10 bg-background border-b border-[#D1D1D1]">
        <div className="flex items-center justify-between pl-8 pr-32 py-3">
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-10 bg-background border-b border-[#D1D1D1]">
      <div className="flex items-center justify-between pl-8 pr-32 py-3">
        {/* Left: App Title - links to homepage */}
        <Link
          href={`/?lang=${lang}`}
          className="text-xl font-[family-name:var(--font-title)] text-foreground no-underline"
        >
          {dict.headerTitle}
        </Link>

        {/* Center: Search (hidden on homepage where hero search exists) */}
        {!isHome && (
          <div className="flex-1 max-w-xl mx-4">
            <SearchInput
              placeholder={dict.searchPlaceholder}
              buttonText={dict.searchButton}
              lang={lang}
              defaultValue={currentQuery}
              compact
            />
          </div>
        )}

        {/* Right: Settings and Festo Logo */}
        <div className="flex items-center gap-4">
          {/* Settings Icon with Dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={handleSettingsClick}
              aria-label={dict.settings}
              aria-expanded={settingsOpen}
              className="p-1.5 rounded hover:bg-muted"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="22"
                height="22"
                className="fill-current text-muted-foreground"
              >
                <path d="M19.14,12.94c.04-.31.06-.63.06-.94,0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24,0-.43.17-.47.41l-.36,2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47,0-.59.22l-1.91,3.32c-.12.21-.08.47.12.61l2.03,1.58c-.04.31-.07.63-.07.94s.02.63.06.94l-2.03,1.58c-.18.14-.23.41-.12.61l1.92,3.32c.12.22.37.29.59.22l2.39-.96c.5.38,1.03.7,1.62.94l.36,2.54c.05.24.24.41.48.41h3.84c.24,0,.44-.17.47-.41l.36-2.54c.59-.24,1.13-.56,1.62-.94l2.39.96c.22.08.47,0,.59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6,3.6,1.62,3.6,3.6-1.62,3.6-3.6,3.6z"/>
              </svg>
            </button>

            {/* Settings Dropdown */}
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-popover rounded-lg shadow-lg border border-border py-2 z-50">
                <div className="px-3 py-2 text-sm font-medium text-muted-foreground border-b border-border">
                  {dict.settingsLanguage}
                </div>
                <button
                  type="button"
                  onClick={() => setLanguage('de')}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between ${
                    lang === 'de' ? 'text-[#0091dc] font-medium' : 'text-foreground'
                  }`}
                >
                  {dict.languageGerman}
                  {lang === 'de' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between ${
                    lang === 'en' ? 'text-[#0091dc] font-medium' : 'text-foreground'
                  }`}
                >
                  {dict.languageEnglish}
                  {lang === 'en' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Theme / Appearance */}
                <div className="px-3 py-2 text-sm font-medium text-muted-foreground border-b border-t border-border mt-1">
                  {dict.settingsAppearance}
                </div>
                <button
                  type="button"
                  onClick={() => { setTheme('light'); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between ${
                    mounted && theme === 'light' ? 'text-[#0091dc] font-medium' : 'text-foreground'
                  }`}
                >
                  {dict.themeLight}
                  {mounted && theme === 'light' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setTheme('dark'); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between ${
                    mounted && theme === 'dark' ? 'text-[#0091dc] font-medium' : 'text-foreground'
                  }`}
                >
                  {dict.themeDark}
                  {mounted && theme === 'dark' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Festo Logo */}
          <Link href={`/?lang=${lang}`}>
            <FestoLogo height={24} className="cursor-pointer" />
          </Link>
        </div>
      </div>
    </header>
  );
}
