'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ArrowLeftIcon, ExternalLinkIcon } from '@/components/icons/festo-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { YouTubePlayer } from './youtube-player';
import { ChapterList } from './chapter-list';
import { AnswerPanel } from './answer-panel';
import { formatDuration } from '@/types/search';
import type { OfficialStatus } from '@/types/search';

interface VideoData {
  videoYoutubeId: string;
  videoTitle: string;
  videoDescription: string | null;
  videoDurationSeconds: number | null;
  videoHasTranscript: boolean;
  channelName: string;
  channelOfficialStatus: OfficialStatus;
}

interface SegmentData {
  id: string;
  text: string;
  summary: string | null;
  start_time: number;
  end_time: number;
}

interface ExplanationState {
  status: 'loading' | 'loaded' | 'error';
  text?: string;
}

interface VideoDetailClientProps {
  video: VideoData;
  segments: SegmentData[];
  initialSegmentId: string | null;
  searchQuery: string | null;
  lang: string;
  labels: {
    back: string;
    official: string;
    community: string;
    openOnYouTube: string;
    videoDuration: string;
    noTranscriptNotice: string;
    chapters: string;
    segmentCount: string;
    noChapters: string;
    transcript: string;
    generatingExplanation: string;
    explanationError: string;
    yourAnswer: string;
    allChapters: string;
    videoDescription: string;
    showDescription: string;
    hideDescription: string;
  };
}

export function VideoDetailClient({
  video,
  segments,
  initialSegmentId,
  searchQuery,
  lang,
  labels,
}: VideoDetailClientProps) {
  const router = useRouter();

  const initialSegment = initialSegmentId
    ? segments.find((s) => s.id === initialSegmentId) ?? segments[0] ?? null
    : segments[0] ?? null;

  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(
    initialSegment?.id ?? null
  );
  const [playerStartTime, setPlayerStartTime] = useState<number>(
    initialSegment?.start_time ?? 0
  );
  const [playerKey, setPlayerKey] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [explanations, setExplanations] = useState<Map<string, ExplanationState>>(
    () => new Map()
  );

  const fetchExplanation = useCallback(async (segmentId: string) => {
    setExplanations((prev) => {
      const next = new Map(prev);
      next.set(segmentId, { status: 'loading' });
      return next;
    });

    try {
      let url = `/api/segment/${segmentId}/explain`;
      if (searchQuery) {
        url += `?q=${encodeURIComponent(searchQuery)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setExplanations((prev) => {
        const next = new Map(prev);
        next.set(segmentId, { status: 'loaded', text: data.explanation });
        return next;
      });
    } catch {
      setExplanations((prev) => {
        const next = new Map(prev);
        next.set(segmentId, { status: 'error' });
        return next;
      });
    }
  }, [searchQuery]);

  // Fetch explanation for initial segment on mount
  useState(() => {
    if (initialSegment) {
      fetchExplanation(initialSegment.id);
    }
  });

  const handleChapterClick = useCallback(
    (segment: SegmentData) => {
      setActiveSegmentId(segment.id);
      setPlayerStartTime(segment.start_time);
      setAutoPlay(true);
      setPlayerKey((k) => k + 1);

      // Fetch explanation if not already loaded
      const existing = explanations.get(segment.id);
      if (!existing || existing.status === 'error') {
        fetchExplanation(segment.id);
      }

      // Update URL for deep-linking without navigation
      const url = new URL(window.location.href);
      url.searchParams.set('segment', segment.id);
      url.searchParams.set('lang', lang);
      window.history.replaceState(null, '', url.toString());
    },
    [lang, explanations, fetchExplanation]
  );

  const activeSegment = activeSegmentId
    ? segments.find((s) => s.id === activeSegmentId) ?? null
    : null;

  const isOfficial = video.channelOfficialStatus === 'official';
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoYoutubeId}${playerStartTime ? `&t=${playerStartTime}s` : ''}`;

  return (
    <div>
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeftIcon size={16} className="mr-2" />
          {labels.back}
        </Button>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold mb-4">{video.videoTitle}</h1>

      {/* Top section: Player + Answer Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Player column */}
        <div className="lg:col-span-3 space-y-3">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <YouTubePlayer
              key={playerKey}
              videoId={video.videoYoutubeId}
              startTime={playerStartTime}
              autoPlay={autoPlay}
              className="w-full h-full"
            />
          </div>

          {/* Compact metadata row */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">{video.channelName}</span>
            <Badge variant={isOfficial ? 'default' : 'secondary'}>
              {isOfficial ? labels.official : labels.community}
            </Badge>
            {video.videoDurationSeconds && (
              <span className="text-muted-foreground">
                {formatDuration(video.videoDurationSeconds)}
              </span>
            )}
            <Button asChild variant="outline" size="sm">
              <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon size={14} className="mr-1.5" />
                {labels.openOnYouTube}
              </a>
            </Button>
          </div>

          {/* No transcript notice */}
          {!video.videoHasTranscript && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
              {labels.noTranscriptNotice}
            </p>
          )}
        </div>

        {/* Answer panel column */}
        <div className="lg:col-span-2">
          <AnswerPanel
            segment={activeSegment}
            explanation={activeSegmentId ? explanations.get(activeSegmentId) : undefined}
            labels={{
              yourAnswer: labels.yourAnswer,
              generatingExplanation: labels.generatingExplanation,
              explanationError: labels.explanationError,
            }}
          />
        </div>
      </div>

      {/* Divider + Chapter grid (full width) */}
      <div className="border-t pt-6 mb-6">
        <ChapterList
          segments={segments}
          activeSegmentId={activeSegmentId}
          onChapterClick={handleChapterClick}
          labels={{
            allChapters: labels.allChapters,
            segmentCount: labels.segmentCount,
            noChapters: labels.noChapters,
          }}
        />
      </div>

      {/* Collapsible video description */}
      {video.videoDescription && (
        <div className="border-t pt-4">
          <button
            onClick={() => setDescriptionOpen((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {descriptionOpen ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            {labels.videoDescription}
          </button>
          {descriptionOpen && (
            <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">
              {video.videoDescription}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
