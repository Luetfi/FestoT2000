'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GapRow } from '@/app/api/admin/gaps/route';

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  // Stable, locale-independent: YYYY-MM-DD from the ISO timestamp.
  return iso.slice(0, 10);
}

export default function GapsPage() {
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/gaps');
      if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
      const data = await res.json();
      setGaps(data.gaps ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Unabgedeckte Suchanfragen</h1>
          <p className="text-sm text-muted-foreground">
            Diese Queries blieben ohne (gute) Lösung. Speise ein passendes Video ein, um sie abzudecken.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          Aktualisieren
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine unabgedeckten Suchanfragen.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Suchanfrage</th>
                <th className="px-3 py-2 font-medium text-right">Suchen</th>
                <th className="px-3 py-2 font-medium text-right">Ungelöst</th>
                <th className="px-3 py-2 font-medium text-right">0 Treffer</th>
                <th className="px-3 py-2 font-medium text-right">Beste Conf.</th>
                <th className="px-3 py-2 font-medium text-right">Zuletzt</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={g.normalized_query} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-medium">{g.sample_query}</span>
                    {g.zero_result_count > 0 && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">
                        keine Treffer
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.search_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.unsolved_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.zero_result_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {g.best_confidence_seen != null ? `${g.best_confidence_seen}%` : '–'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatDate(g.last_searched_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/?q=${encodeURIComponent(g.sample_query)}`}
                      target="_blank"
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      In Suche testen
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
