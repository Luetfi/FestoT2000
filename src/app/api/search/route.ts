import { NextRequest, NextResponse } from 'next/server';
import { mockSegments, searchMockSegments, filterBySource } from '@/lib/mock-data/segments';
import type { SearchResponse } from '@/types/search';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const source = searchParams.get('source') as 'all' | 'official' | 'community' | null;

  // Simulate network delay for realistic testing
  await new Promise((resolve) => setTimeout(resolve, 200));

  const results = query
    ? searchMockSegments(query, source || 'all')
    : filterBySource(mockSegments, source || 'all');

  const response: SearchResponse = {
    query,
    results,
    total: results.length,
  };

  return NextResponse.json(response);
}
