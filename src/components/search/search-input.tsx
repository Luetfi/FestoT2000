'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchIcon } from '@/components/icons/festo-icons';

interface SearchInputProps {
  placeholder: string;
  buttonText: string;
  lang: string;
  defaultValue?: string;
  compact?: boolean;
}

export function SearchInput({
  placeholder,
  buttonText,
  lang,
  defaultValue = '',
  compact = false,
}: SearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}&lang=${lang}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <div className="relative flex-1">
        <SearchIcon size={compact ? 16 : 20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={compact ? "pl-9 h-9 text-sm text-foreground" : "pl-10 h-12 text-lg text-foreground"}
        />
      </div>
      <Button type="submit" size={compact ? "sm" : "lg"} className={compact ? "h-9 px-4" : "h-12 px-8"}>
        {buttonText}
      </Button>
    </form>
  );
}
