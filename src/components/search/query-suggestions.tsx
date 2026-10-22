'use client';

import { useRouter } from 'next/navigation';
import type { QuerySuggestion } from '@/types/search';

interface QuerySuggestionsProps {
  suggestions: QuerySuggestion[];
  lang: string;
  label: string;
}

export function QuerySuggestions({ suggestions, lang, label }: QuerySuggestionsProps) {
  const router = useRouter();

  if (suggestions.length === 0) return null;

  const handleClick = (term: string) => {
    const params = new URLSearchParams();
    params.set('q', term);
    params.set('lang', lang);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
      <span className="text-sm text-muted-foreground">{label}:</span>
      {suggestions.map((s) => (
        <button
          key={s.term}
          type="button"
          onClick={() => handleClick(s.term)}
          title={s.reason}
          className="rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {s.term}
        </button>
      ))}
    </div>
  );
}
