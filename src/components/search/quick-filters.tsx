'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

interface QuickFilter {
  id: string;
  label: string;
  query: string;
}

interface QuickFiltersProps {
  filters: QuickFilter[];
  lang: string;
}

export function QuickFilters({ filters, lang }: QuickFiltersProps) {
  const router = useRouter();

  const handleFilterClick = (query: string) => {
    router.push(`/?q=${encodeURIComponent(query)}&lang=${lang}`);
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {filters.map((filter) => (
        <Badge
          key={filter.id}
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 px-4 py-2 text-sm transition-colors"
          onClick={() => handleFilterClick(filter.query)}
        >
          {filter.label}
        </Badge>
      ))}
    </div>
  );
}
