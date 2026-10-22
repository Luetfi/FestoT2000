'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchIcon } from '@/components/icons/festo-icons';

const MIN_QUERY_LENGTH = 3;

interface SearchInputProps {
  placeholder: string;
  buttonText: string;
  minLengthHint: string;
  lang: string;
  defaultValue?: string;
  compact?: boolean;
}

export function SearchInput({
  placeholder,
  buttonText,
  minLengthHint,
  lang,
  defaultValue = '',
  compact = false,
}: SearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [showHint, setShowHint] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setShowHint(true);
      return;
    }
    setShowHint(false);
    const params = new URLSearchParams();
    params.set('q', trimmed);
    params.set('lang', lang);
    router.push(`/?${params.toString()}`);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (showHint && e.target.value.trim().length >= MIN_QUERY_LENGTH) {
      setShowHint(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2 w-full">
        <div className="relative flex-1">
          <SearchIcon size={compact ? 16 : 20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder={placeholder}
            className={compact ? "pl-9 h-9 text-sm text-foreground" : "pl-10 h-12 text-lg text-foreground"}
          />
        </div>
        <Button type="submit" size={compact ? "sm" : "lg"} className={compact ? "h-9 px-4" : "h-12 px-8"}>
          {buttonText}
        </Button>
      </form>
      {showHint && (
        <p className="text-sm text-muted-foreground mt-1.5 ml-1">{minLengthHint}</p>
      )}
    </div>
  );
}
