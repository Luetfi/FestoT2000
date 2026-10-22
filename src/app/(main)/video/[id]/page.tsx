import 'server-only';
import { notFound } from 'next/navigation';
import { VideoDetailClient } from '@/components/video/video-detail-client';
import { query, queryOne } from '@/lib/db';
import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries/get-dictionary';
import { generateSummaries } from '@/lib/ai/summaries';
import type { OfficialStatus } from '@/types/search';

interface VideoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; segment?: string; q?: string }>;
}

export default async function VideoPage({ params, searchParams }: VideoPageProps) {
  const { id } = await params;
  const { lang: langParam, segment: segmentParam, q: queryParam } = await searchParams;
  const lang = isValidLocale(langParam) ? langParam : defaultLocale;
  const dict = await getDictionary(lang);

  // Parse video ID as number for DB query
  const videoId = parseInt(id, 10);
  if (isNaN(videoId)) {
    notFound();
  }

  // Load video with channel data
  const video = await queryOne<{
    id: number;
    youtube_id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    has_transcript: boolean | null;
    channel_name: string | null;
    channel_official_status: string | null;
  }>(
    `SELECT v.id, v.youtube_id, v.title, v.description, v.thumbnail_url,
            v.duration_seconds, v.has_transcript,
            c.name AS channel_name, c.official_status AS channel_official_status
     FROM videos v
     LEFT JOIN channels c ON c.id = v.channel_id
     WHERE v.id = $1`,
    [videoId]
  );

  if (!video) {
    notFound();
  }

  // Load ALL segments for this video
  const segmentRows = await query<{
    id: number;
    text: string;
    summary: string | null;
    start_time: number;
    end_time: number;
  }>(
    `SELECT id, text, summary, start_time, end_time
     FROM segments
     WHERE video_id = $1
     ORDER BY start_time ASC`,
    [videoId]
  );

  let segments = segmentRows.map((row) => ({
    id: String(row.id),
    text: row.text,
    summary: row.summary ?? null,
    start_time: row.start_time,
    end_time: row.end_time,
  }));

  // Generate missing summaries on-the-fly and cache them
  const missingSummarySegs = segments.filter((s) => !s.summary);
  if (missingSummarySegs.length > 0) {
    const newSummaries = await generateSummaries(missingSummarySegs.map((s) => s.text));
    const summaryMap = new Map<string, string>();
    for (let i = 0; i < missingSummarySegs.length; i++) {
      const summary = newSummaries[i];
      if (summary) {
        summaryMap.set(missingSummarySegs[i].id, summary);
        // Cache in DB (fire-and-forget)
        query('UPDATE segments SET summary = $2 WHERE id = $1', [
          parseInt(missingSummarySegs[i].id, 10),
          summary,
        ]).catch((err) => console.error('Caching segment summary failed:', err));
      }
    }
    segments = segments.map((s) => ({
      ...s,
      summary: s.summary || summaryMap.get(s.id) || null,
    }));
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <VideoDetailClient
          video={{
            videoYoutubeId: video.youtube_id ?? '',
            videoTitle: video.title ?? '',
            videoDescription: video.description ?? null,
            videoDurationSeconds: video.duration_seconds ?? null,
            videoHasTranscript: video.has_transcript ?? false,
            channelName: video.channel_name ?? 'Unknown',
            channelOfficialStatus: (video.channel_official_status as OfficialStatus) ?? 'unknown',
          }}
          videoId={videoId}
          segments={segments}
          initialSegmentId={segmentParam ?? null}
          searchQuery={queryParam ?? null}
          lang={lang}
          feedbackLabels={{
            question: dict.feedbackQuestionVideo,
            helpful: dict.feedbackHelpful,
            notHelpful: dict.feedbackNotHelpful,
            thanks: dict.feedbackThanks,
            reasons: {
              not_relevant: dict.feedbackReasonNotRelevant,
              wrong_topic: dict.feedbackReasonWrongTopic,
              too_basic: dict.feedbackReasonTooBasic,
              bad_quality: dict.feedbackReasonBadQuality,
              other: dict.feedbackReasonOther,
            },
          }}
          labels={{
            back: dict.back,
            official: dict.officialLabel,
            community: dict.communityLabel,
            openOnYouTube: dict.openOnYouTube,
            videoDuration: dict.videoDuration,
            noTranscriptNotice: dict.noTranscriptNotice,
            chapters: dict.chapters,
            segmentCount: dict.segmentCount,
            noChapters: dict.noChapters,
            transcript: dict.transcript,
            generatingExplanation: dict.generatingExplanation,
            explanationError: dict.explanationError,
            yourAnswer: dict.yourAnswer,
            browseNotice: dict.browseNotice,
            allChapters: dict.allChapters,
            videoDescription: dict.videoDescription,
            showDescription: dict.showDescription,
            hideDescription: dict.hideDescription,
          }}
        />
      </main>
    </div>
  );
}
