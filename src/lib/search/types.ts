import type { SearchResultSegment } from '@/types/search';

export interface ParsedQuery {
  originalQuery: string;
  errorCodes: string[];
  productKeywords: string[];
  enhancedQuery: string; // Query with detected terms appended for full-text boost
}

export interface SearchParams {
  query: string;
  language: 'de' | 'en';
}
