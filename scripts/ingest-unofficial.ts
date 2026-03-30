/**
 * Ingest unofficial/community videos + a full channel into the app.
 * Only videos with German or English transcripts will be fully ingested.
 *
 * Usage: npx tsx --env-file=.env.local scripts/ingest-unofficial.ts
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
// @ts-ignore - ESM direct import needed for youtube-transcript v1.3.0
import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';

// --- Config ---
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_SECRET!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

for (const [k, v] of Object.entries({ YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
}

const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ============================================================
// Individual video IDs to ingest
// ============================================================
const INDIVIDUAL_VIDEO_IDS = [
  'Qfc0zsWAyio',
  'kTD7E95E6sM',
  'AuYCtVOuP5k',
  'KL3rNhf5U9A',
  '3YzCgCRRkV0',
  '6DvLtfyyGdY',
  'X16OPuBgyhA',
  'zc_Z4w5z_JA',
  'FJ2kI8aSQwI',
];

// Channel handle to ingest all videos from
const CHANNEL_HANDLE = '@dr.gutierrez';

const CONCURRENCY = 3;

// ============================================================
// YouTube helpers
// ============================================================

function parseDuration(d: string | null | undefined): number | null {
  if (!d) return null;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0);
}

interface VideoMeta {
  videoId: string; title: string; description: string | null;
  channelId: string; channelTitle: string; thumbnailUrl: string | null;
  publishedAt: string | null; durationSeconds: number | null;
}

async function fetchVideoMetadata(videoId: string): Promise<VideoMeta> {
  const res = await youtube.videos.list({ part: ['snippet', 'contentDetails'], id: [videoId] });
  const v = res.data.items?.[0];
  if (!v?.snippet) throw new Error(`Video not found: ${videoId}`);
  const s = v.snippet;
  return {
    videoId,
    title: s.title || 'Untitled',
    description: s.description || null,
    channelId: s.channelId || '',
    channelTitle: s.channelTitle || 'Unknown',
    thumbnailUrl: s.thumbnails?.high?.url || s.thumbnails?.default?.url || null,
    publishedAt: s.publishedAt || null,
    durationSeconds: parseDuration(v.contentDetails?.duration),
  };
}

async function resolveChannelId(handle: string): Promise<string> {
  // Use search to resolve @handle to channel ID
  const res = await youtube.search.list({
    part: ['snippet'],
    q: handle,
    type: ['channel'],
    maxResults: 1,
  });
  const channelId = res.data.items?.[0]?.snippet?.channelId;
  if (!channelId) throw new Error(`Could not resolve channel handle: ${handle}`);
  console.log(`Resolved ${handle} -> channel ID: ${channelId}`);
  return channelId;
}

async function fetchChannelVideoIds(channelId: string, max = 500): Promise<string[]> {
  const chRes = await youtube.channels.list({ part: ['contentDetails'], id: [channelId] });
  const uploadsId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error(`No uploads playlist for ${channelId}`);

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsId,
      maxResults: 50,
      pageToken,
    });
    for (const item of res.data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < max);

  return ids.slice(0, max);
}

// ============================================================
// Transcript
// ============================================================

interface TSegment { text: string; offset: number; duration: number; }

async function getTranscript(videoId: string): Promise<{ segments: TSegment[]; language: string } | null> {
  for (const lang of ['de', 'en']) {
    try {
      const subs = await fetchTranscript(videoId, { lang });
      if (subs && subs.length > 0) {
        return {
          segments: subs.map((s: any) => ({ text: s.text, offset: Math.round(s.offset), duration: Math.round(s.duration) })),
          language: lang,
        };
      }
    } catch { /* next language */ }
  }
  return null;
}

// ============================================================
// Chunking
// ============================================================

interface Chunk { text: string; startTime: number; endTime: number; }

function chunkTranscript(segments: TSegment[], target = 800): Chunk[] {
  if (!segments.length) return [];
  const chunks: Chunk[] = [];
  let curText = '', curStart = segments[0].offset, curEnd = segments[0].offset;

  for (const seg of segments) {
    curText += (curText ? ' ' : '') + seg.text.trim();
    curEnd = seg.offset + seg.duration;
    if (curText.length >= target) {
      chunks.push({ text: curText.trim(), startTime: curStart / 1000, endTime: curEnd / 1000 });
      curText = '';
      curStart = curEnd;
    }
  }
  if (curText.trim()) {
    chunks.push({ text: curText.trim(), startTime: curStart / 1000, endTime: curEnd / 1000 });
  }
  return chunks;
}

// ============================================================
// Summaries
// ============================================================

const SUMMARY_SYSTEM_PROMPT =
  'Du fasst Transkript-Abschnitte in maximal 10 Wörtern auf Deutsch zusammen. Beschreibe WAS erklärt oder besprochen wird. Antworte IMMER auf Deutsch, auch wenn der Text auf Englisch ist. Antworte nur mit der Zusammenfassung, ohne Anführungszeichen.';

async function generateSummary(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 50,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  } catch (e: any) {
    if (e?.status === 429) {
      await new Promise(r => setTimeout(r, 1000));
      return generateSummary(text);
    }
    console.warn('Summary generation failed:', e?.message);
    return '';
  }
}

async function generateSummaries(texts: string[]): Promise<string[]> {
  const results: string[] = new Array(texts.length).fill('');
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);
    const batchResults = await Promise.all(batch.map(t => generateSummary(t)));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }
  return results;
}

// ============================================================
// Embeddings
// ============================================================

async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    encoding_format: 'float',
  });
  return res.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

// ============================================================
// Channel classification
// ============================================================

function classifyChannel(name: string): 'official' | 'community' {
  const n = name.toLowerCase().trim();
  const blocklist = (process.env.CHANNEL_BLOCKLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (blocklist.some(b => n.includes(b))) return 'community';
  const allowlist = (process.env.CHANNEL_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowlist.some(a => n.includes(a))) return 'official';
  return n.includes('festo') ? 'official' : 'community';
}

// ============================================================
// Ingestion pipeline
// ============================================================

interface Result { videoId: string; status: 'success' | 'no_transcript' | 'error'; segments: number; error?: string; title?: string; }

async function ingestVideo(videoId: string): Promise<Result> {
  try {
    const meta = await fetchVideoMetadata(videoId);

    // Upsert channel
    let channelDbId: number;
    const { data: existing } = await supabase.from('channels').select('id').eq('youtube_id', meta.channelId).maybeSingle();
    if (existing) {
      channelDbId = (existing as any).id;
    } else {
      const chRes = await youtube.channels.list({ part: ['snippet'], id: [meta.channelId] });
      const chSnip = chRes.data.items?.[0]?.snippet;
      const { data: newCh, error: chErr } = await supabase.from('channels').insert({
        youtube_id: meta.channelId,
        name: chSnip?.title || 'Unknown',
        description: chSnip?.description || null,
        thumbnail_url: chSnip?.thumbnails?.high?.url || null,
        official_status: classifyChannel(chSnip?.title || ''),
      } as any).select('id').single();
      if (chErr || !newCh) throw chErr || new Error('channel insert failed');
      channelDbId = (newCh as any).id;
    }

    // Upsert video
    const { data: video, error: vErr } = await supabase.from('videos').upsert({
      youtube_id: videoId,
      channel_id: channelDbId,
      title: meta.title,
      description: meta.description,
      thumbnail_url: meta.thumbnailUrl,
      duration_seconds: meta.durationSeconds,
      published_at: meta.publishedAt,
      has_transcript: false,
    } as any, { onConflict: 'youtube_id' }).select('id').single();
    if (vErr || !video) throw vErr || new Error('video upsert failed');
    const videoDbId = (video as any).id;

    // Transcript
    const transcript = await getTranscript(videoId);
    if (!transcript) return { videoId, status: 'no_transcript', segments: 0, title: meta.title };

    // Delete old segments + transcripts for clean re-ingestion
    await supabase.from('segments').delete().eq('video_id', videoDbId);
    await supabase.from('transcripts').delete().eq('video_id', videoDbId);

    const fullText = transcript.segments.map(s => s.text).join(' ');
    const { data: tRow, error: tErr } = await supabase.from('transcripts').insert({
      video_id: videoDbId,
      full_text: fullText,
      language: transcript.language,
      source_type: 'unknown',
    } as any).select('id').single();
    if (tErr || !tRow) throw tErr || new Error('transcript insert failed');

    await supabase.from('videos').update({ has_transcript: true } as any).eq('id', videoDbId);

    // Chunk + embed + summarize
    const chunks = chunkTranscript(transcript.segments);
    if (!chunks.length) return { videoId, status: 'no_transcript', segments: 0, title: meta.title };

    const texts = chunks.map(c => c.text);
    const [embeddings, summaries] = await Promise.all([
      embed(texts),
      generateSummaries(texts),
    ]);

    const segRows = chunks.map((c, i) => ({
      video_id: videoDbId,
      transcript_id: (tRow as any).id,
      text: c.text,
      summary: summaries[i] || null,
      start_time: c.startTime,
      end_time: c.endTime,
      embedding: embeddings[i],
    }));

    const { error: sErr } = await supabase.from('segments').insert(segRows as any);
    if (sErr) throw sErr;

    return { videoId, status: 'success', segments: chunks.length, title: meta.title };
  } catch (e: any) {
    return { videoId, status: 'error', segments: 0, error: e?.message || String(e) };
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== Unofficial Video Ingestion ===\n');

  // 1. Collect all video IDs
  const allVideoIds = new Set<string>(INDIVIDUAL_VIDEO_IDS);

  // 2. Resolve channel and get its video IDs
  console.log(`Resolving channel ${CHANNEL_HANDLE}...`);
  try {
    const channelId = await resolveChannelId(CHANNEL_HANDLE);
    console.log('Fetching video IDs from channel uploads...');
    const channelVideoIds = await fetchChannelVideoIds(channelId);
    console.log(`Found ${channelVideoIds.length} videos from ${CHANNEL_HANDLE}`);
    for (const id of channelVideoIds) allVideoIds.add(id);
  } catch (e: any) {
    console.error(`Failed to resolve channel: ${e.message}`);
  }

  const videoIds = Array.from(allVideoIds);
  console.log(`\nTotal unique videos to process: ${videoIds.length}\n`);

  if (!videoIds.length) return;

  // 3. Process videos in batches
  const results: Result[] = [];
  const startTime = Date.now();

  for (let i = 0; i < videoIds.length; i += CONCURRENCY) {
    const batch = videoIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(id => ingestVideo(id)));

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      const idx = i + j + 1;
      if (r.status === 'fulfilled') {
        const v = r.value;
        const icon = v.status === 'success' ? '+' : v.status === 'no_transcript' ? '-' : '!';
        console.log(`[${idx}/${videoIds.length}] ${icon} ${v.videoId} — ${v.status}${v.segments ? ` (${v.segments} seg)` : ''}${v.title ? ` "${v.title}"` : ''}${v.error ? ` ERR: ${v.error}` : ''}`);
        results.push(v);
      } else {
        console.error(`[${idx}/${videoIds.length}] ! ${batch[j]} — FATAL: ${r.reason}`);
        results.push({ videoId: batch[j], status: 'error', segments: 0, error: String(r.reason) });
      }
    }

    if (i + CONCURRENCY < videoIds.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 4. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const ok = results.filter(r => r.status === 'success');
  const noT = results.filter(r => r.status === 'no_transcript');
  const errs = results.filter(r => r.status === 'error');
  const segs = results.reduce((s, r) => s + r.segments, 0);

  console.log(`\n=== DONE (${elapsed}s) ===`);
  console.log(`Success:        ${ok.length} videos, ${segs} segments`);
  console.log(`No transcript:  ${noT.length}`);
  console.log(`Errors:         ${errs.length}`);

  if (noT.length) {
    console.log(`\nSkipped (no DE/EN transcript):`);
    noT.forEach(r => console.log(`  ${r.videoId}${r.title ? ` — "${r.title}"` : ''}`));
  }

  if (errs.length) {
    console.log(`\nFailed:`);
    errs.forEach(r => console.log(`  ${r.videoId}: ${r.error}`));
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
