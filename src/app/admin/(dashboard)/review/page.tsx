'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/types/search';
import type { ReviewVideo } from '@/app/api/admin/review/route';

export default function ReviewPage() {
  const [videos, setVideos] = useState<ReviewVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/review');
      if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
      const data = await res.json();
      setVideos(data.videos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(videoId: number, action: 'approve' | 'reject') {
    setBusy(videoId);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, action }),
      });
      if (!res.ok) throw new Error(`Aktion fehlgeschlagen (${res.status})`);
      // Optimistically remove the decided video from the queue.
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Community-Videos verwalten</h1>
          <p className="text-sm text-muted-foreground">
            Diese Community-Videos sind in der Suche aktiv. Entferne ungeeignete mit einem Klick.
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
      ) : videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Community-Videos in der Suche.</p>
      ) : (
        <ul className="space-y-3">
          {videos.map((video) => (
            <li key={video.id} className="rounded-lg border bg-card">
              <div className="flex gap-4 p-3">
                <Link
                  href={`/video/${video.id}`}
                  target="_blank"
                  className="relative shrink-0 w-[180px] aspect-video overflow-hidden rounded-md bg-muted"
                >
                  {video.thumbnail_url && (
                    <Image
                      src={video.thumbnail_url}
                      alt={video.title}
                      fill
                      className="object-cover"
                      sizes="180px"
                    />
                  )}
                  {video.duration_seconds != null && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {formatDuration(video.duration_seconds)}
                    </span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                      {video.title}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {(video.positive_count > 0 || video.negative_count > 0) && (
                        <Badge
                          variant={video.negative_count > 0 ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          👍 {video.positive_count} / 👎 {video.negative_count}
                        </Badge>
                      )}
                      {video.relevance_score != null && (
                        <Badge variant="secondary" className="text-xs">
                          Score {video.relevance_score}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {video.channel_name ?? 'Unbekannter Kanal'}
                    {video.content_type ? ` · ${video.content_type}` : ''}
                    {` · ${video.segment_count} Segmente`}
                  </p>

                  {video.relevance_reason && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {video.relevance_reason}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-3">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide(video.id, 'reject')}
                      disabled={busy === video.id}
                    >
                      Aus Suche entfernen
                    </Button>
                    <a
                      href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Auf YouTube ansehen
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
