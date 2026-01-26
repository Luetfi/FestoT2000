'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface SearchInputProps {
  placeholder: string;
  buttonText: string;
  lang: string;
  defaultValue?: string;
}

export function SearchInput({
  placeholder,
  buttonText,
  lang,
  defaultValue = '',
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-10 h-12 text-lg"
          autoFocus
        />
      </div>
      <Button type="submit" size="lg" className="h-12 px-8">
        {buttonText}
      </Button>
    </form>
  );
}
