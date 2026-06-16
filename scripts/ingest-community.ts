/**
 * Discover & ingest RELEVANT community Festo videos from YouTube.
 *
 * Pipeline per run:
 *   1. Discover candidates: curated community channels + keyword search
 *      (only videos that actually have captions).
 *   2. Dedup against everything already in the DB (any review_status).
 *   3. Cheap metadata prefilter (Festo mention + plausible duration).
 *   4. Fetch DE/EN transcript (skip if none).
 *   5. Relevance gate (gpt-4o-mini, strict): must be about Festo AND solve a
 *      concrete problem. Runs BEFORE embedding so junk costs no embedding credits.
 *   6. Accepted videos are fully ingested (embeddings/segments) and marked
 *      review_status='pending' → they appear in search only after manual approval
 *      via /admin/review. Rejected videos are kept as 'rejected' so they aren't
 *      re-processed on the next run.
 *
 * Self-contained on purpose (does NOT import from src/) to avoid server-only /
 * path-alias issues under tsx — same convention as ingest-channel.ts. The gate
 * mirrors src/lib/ingestion/relevance-gate.ts and the chunker mirrors
 * src/lib/ingestion/chunker.ts.
 *
 * Usage: npx tsx --env-file=.env.local scripts/ingest-community.ts [maxPerQuery]
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
// @ts-ignore - ESM direct import needed for youtube-transcript v1.3.0
import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';

// --- Config from env ---
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

// --- CLI args ---
// arg1 = how many NEW community videos to add before stopping (default 100),
// or "all" to evaluate every discovered candidate (no early stop).
const TARGET_ARG = process.argv[2] || '100';
const TARGET_COMMUNITY_VIDEOS = TARGET_ARG === 'all' ? Infinity : parseInt(TARGET_ARG, 10);
const TARGET_LABEL = Number.isFinite(TARGET_COMMUNITY_VIDEOS) ? String(TARGET_COMMUNITY_VIDEOS) : 'all';
const MAX_PER_QUERY = 25;           // results per keyword video search
const MAX_VIDEOS_PER_CHANNEL = 60;  // uploads pulled per discovered channel
const CONCURRENCY = 3;

// ============================================================
// Discovery config — tune these lists to widen/narrow coverage
// ============================================================

// Curated community channels (handles or channel IDs). All uploads are pulled
// and then individually gated, so it is safe to add broad practitioner channels.
const COMMUNITY_CHANNEL_HANDLES: string[] = [
  '@dr.gutierrez',
];

// Channel searches: used to AUTO-DISCOVER community channels (integrators,
// trainers, practitioners). Only channels NOT classified as official are pulled.
const COMMUNITY_CHANNEL_SEARCH_QUERIES: string[] = [
  'Festo tutorial',
  'Festo automation tutorial',
  'Festo SPS programmieren',
  'Festo CMMT',
  'Festo CPX',
  'Festo Inbetriebnahme',
  'Festo servo drive',
  'Festo Ventilinsel',
  'Festo PLC programming',
  'Festo pneumatics tutorial',
  'Festo Motion Terminal',
  'Festo CODESYS',
];

// Keyword video searches. Mix of German + English, focused on concrete problems
// so the search itself already skews toward solution content. Captions required.
const FESTO_SEARCH_QUERIES: { q: string; lang: string }[] = [
  { q: 'Festo CMMT-AS Inbetriebnahme', lang: 'de' },
  { q: 'Festo CMMT Fehler beheben', lang: 'de' },
  { q: 'Festo CPX-E Konfiguration', lang: 'de' },
  { q: 'Festo Ventilinsel parametrieren', lang: 'de' },
  { q: 'Festo Motorcontroller Inbetriebnahme', lang: 'de' },
  { q: 'Festo Antrieb Störung Diagnose', lang: 'de' },
  { q: 'Festo FCT Festo Configuration Tool Tutorial', lang: 'de' },
  { q: 'Festo SPS Programmierung Tutorial', lang: 'de' },
  { q: 'Festo CODESYS Beispiel', lang: 'de' },
  { q: 'Festo Greifer Montage', lang: 'de' },
  { q: 'Festo CMMT-AS commissioning tutorial', lang: 'en' },
  { q: 'Festo CPX troubleshooting', lang: 'en' },
  { q: 'Festo valve terminal configuration', lang: 'en' },
  { q: 'Festo servo drive setup', lang: 'en' },
  { q: 'Festo error code fix', lang: 'en' },
  { q: 'Festo PLC programming tutorial', lang: 'en' },
  { q: 'Festo Motion Terminal setup', lang: 'en' },
  { q: 'Festo cylinder installation', lang: 'en' },
];

// Cheap metadata prefilter: must mention Festo or a known product family.
const FESTO_KEYWORDS = [
  'festo', 'cmmt', 'cpx', 'mpa', 'vtug', 'vuvg', 'cdsb', 'cmmp', 'emca',
  'ventilinsel', 'valve terminal', 'festo didactic', 'fct',
];
const MIN_DURATION_SECONDS = 60;   // skip Shorts / trailers
const MAX_DURATION_SECONDS = 4 * 3600; // skip implausibly long streams

// ============================================================
// Relevance gate (mirrors src/lib/ingestion/relevance-gate.ts)
// ============================================================

const GATE_MODEL = 'gpt-4o-mini';
const GATE_SCORE_THRESHOLD = 70;
const GATE_HEAD_CHARS = 2200;
const GATE_MIDDLE_CHARS = 800;

const GATE_SYSTEM_PROMPT = `Du bist ein strenger Kurator für eine Festo-Wissensdatenbank. Du entscheidest, ob ein YouTube-Video aufgenommen werden soll.

Ein Video wird NUR aufgenommen, wenn BEIDE Bedingungen erfüllt sind:
1. Es behandelt erkennbar Festo-Produkte oder -Themen (z. B. CMMT, CPX, CPX-E, MPA, VTUG, Ventilinseln, Antriebe, Motorcontroller, Pneumatik/Automatisierung von Festo).
2. Es löst ein konkretes technisches Problem oder zeigt einen konkreten Arbeitsschritt: Inbetriebnahme, Störungs-/Fehlerbehebung, Parametrierung/Konfiguration, Programmierung, Montage/Reparatur oder Diagnose.

Lehne ab (relevant=false): reines Marketing, Imagefilme, Messeauftritte, Unternehmensvorstellungen, reine Produktankündigungen ohne Anleitung, sowie alles, das nicht erkennbar mit Festo zu tun hat.

Vergib einen Score von 0 bis 100:
- 85-100: behandelt Festo UND löst sehr klar ein konkretes Problem mit umsetzbaren Schritten.
- 70-84: Festo-bezogen und klar problemlösend, aber etwas allgemeiner.
- 40-69: thematisch verwandt, aber kaum konkrete Problemlösung.
- 0-39: kein Festo-Bezug oder reines Marketing/Off-Topic.

Bewerte ausschließlich anhand von Titel, Beschreibung und Transkript-Auszug. Nutze kein externes Wissen.

Antworte NUR mit JSON in der Form:
{"relevant": <true|false>, "score": <0-100>, "contentType": "<troubleshooting|commissioning|configuration|programming|assembly|diagnostics|other>", "reason": "<kurze Begründung auf Deutsch>"}`;

interface GateResult { relevant: boolean; score: number; contentType: string; reason: string; }

function buildTranscriptSample(transcript: string): string {
  const text = transcript.trim();
  if (text.length <= GATE_HEAD_CHARS + GATE_MIDDLE_CHARS) return text;
  const head = text.slice(0, GATE_HEAD_CHARS);
  const midStart = Math.floor(text.length / 2 - GATE_MIDDLE_CHARS / 2);
  const middle = text.slice(midStart, midStart + GATE_MIDDLE_CHARS);
  return `${head}\n[...]\n${middle}`;
}

async function gateVideo(title: string, description: string | null, transcript: string): Promise<GateResult> {
  const fallback: GateResult = {
    relevant: false, score: 0, contentType: 'other',
    reason: 'Relevanz-Gate nicht verfügbar (Fehler) – konservativ abgelehnt.',
  };
  const userContent = `Titel: ${title}\n\nBeschreibung:\n${(description ?? '').slice(0, 800)}\n\nTranskript-Auszug:\n${buildTranscriptSample(transcript)}`;
  try {
    const response = await openai.chat.completions.create({
      model: GATE_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: GATE_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });
    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<GateResult>;
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 0))));
    return {
      relevant: parsed.relevant === true && score >= GATE_SCORE_THRESHOLD,
      score,
      contentType: typeof parsed.contentType === 'string' ? parsed.contentType : 'other',
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  } catch (e: any) {
    if (e?.status === 429) { await sleep(1500); return gateVideo(title, description, transcript); }
    console.warn('Gate failed:', e?.message);
    return fallback;
  }
}

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

async function resolveChannelId(handle: string): Promise<string | null> {
  // Already a channel ID
  if (/^UC[\w-]{20,}$/.test(handle)) return handle;
  const res = await youtube.search.list({ part: ['snippet'], q: handle, type: ['channel'], maxResults: 1 });
  return res.data.items?.[0]?.snippet?.channelId ?? null;
}

async function fetchChannelVideoIds(channelId: string, max = 200): Promise<string[]> {
  const chRes = await youtube.channels.list({ part: ['contentDetails'], id: [channelId] });
  const uploadsId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await youtube.playlistItems.list({
      part: ['contentDetails'], playlistId: uploadsId, maxResults: 50, pageToken,
    });
    for (const item of res.data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}

async function searchVideoIds(query: string, lang: string, max: number): Promise<string[]> {
  const res = await youtube.search.list({
    part: ['id'], q: query, type: ['video'],
    videoCaption: 'closedCaption', // only videos that have captions → transcript-able
    maxResults: Math.min(max, 50), relevanceLanguage: lang,
  });
  return (res.data.items ?? []).map(i => i.id?.videoId).filter((id): id is string => !!id);
}

// ============================================================
// Transcript + chunking (mirror src/lib/ingestion/chunker.ts)
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
// Summaries + embeddings
// ============================================================

const SUMMARY_SYSTEM_PROMPT =
  'Du fasst Transkript-Abschnitte in maximal 10 Wörtern auf Deutsch zusammen. Beschreibe WAS erklärt oder besprochen wird. Antworte IMMER auf Deutsch, auch wenn der Text auf Englisch ist. Antworte nur mit der Zusammenfassung, ohne Anführungszeichen.';

async function generateSummary(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 50,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  } catch (e: any) {
    if (e?.status === 429) { await sleep(1000); return generateSummary(text); }
    return '';
  }
}

async function generateSummaries(texts: string[]): Promise<string[]> {
  const results: string[] = new Array(texts.length).fill('');
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);
    const batchResults = await Promise.all(batch.map(t => generateSummary(t)));
    for (let j = 0; j < batchResults.length; j++) results[i + j] = batchResults[j];
  }
  return results;
}

async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small', input: texts, encoding_format: 'float',
  });
  return res.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

function classifyChannel(name: string): 'official' | 'community' {
  const n = name.toLowerCase().trim();
  const blocklist = (process.env.CHANNEL_BLOCKLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (blocklist.some(b => n.includes(b))) return 'community';
  const allowlist = (process.env.CHANNEL_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowlist.some(a => n.includes(a))) return 'official';
  return n.includes('festo') ? 'official' : 'community';
}

function passesMetadataPrefilter(meta: VideoMeta): boolean {
  const hay = `${meta.title} ${meta.description ?? ''} ${meta.channelTitle}`.toLowerCase();
  if (!FESTO_KEYWORDS.some(k => hay.includes(k))) return false;
  const dur = meta.durationSeconds;
  if (dur != null && (dur < MIN_DURATION_SECONDS || dur > MAX_DURATION_SECONDS)) return false;
  return true;
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// Ingestion (gate before embedding; pending on accept)
// ============================================================

type Status = 'success' | 'no_transcript' | 'rejected_irrelevant' | 'skipped_prefilter' | 'error';
interface Result { videoId: string; status: Status; segments: number; title?: string; score?: number; reason?: string; error?: string; official_status?: 'official' | 'community'; }

async function ingestVideo(videoId: string): Promise<Result> {
  try {
    const meta = await fetchVideoMetadata(videoId);
    const official_status = classifyChannel(meta.channelTitle);

    // 3. Cheap metadata prefilter — no DB row written, just save quota/credits.
    if (!passesMetadataPrefilter(meta)) {
      return { videoId, status: 'skipped_prefilter', segments: 0, title: meta.title, official_status };
    }

    // Upsert channel
    let channelDbId: number;
    const { data: existing } = await supabase.from('channels').select('id').eq('youtube_id', meta.channelId).maybeSingle();
    if (existing) {
      channelDbId = (existing as any).id;
    } else {
      const chRes = await youtube.channels.list({ part: ['snippet'], id: [meta.channelId] });
      const chSnip = chRes.data.items?.[0]?.snippet;
      // Upsert (not insert): under concurrency, sibling videos of the same new
      // channel race to create it — onConflict makes that idempotent.
      const { data: newCh, error: chErr } = await supabase.from('channels').upsert({
        youtube_id: meta.channelId,
        name: chSnip?.title || 'Unknown',
        description: chSnip?.description || null,
        thumbnail_url: chSnip?.thumbnails?.high?.url || null,
        official_status: classifyChannel(chSnip?.title || ''),
      } as any, { onConflict: 'youtube_id' }).select('id').single();
      if (chErr || !newCh) throw chErr || new Error('channel insert failed');
      channelDbId = (newCh as any).id;
    }

    // Upsert video as approved: the strict gate below is the quality bar, so
    // accepted videos go live immediately (no manual review needed). Rejected
    // videos are flipped to 'rejected' further down.
    const { data: video, error: vErr } = await supabase.from('videos').upsert({
      youtube_id: videoId,
      channel_id: channelDbId,
      title: meta.title,
      description: meta.description,
      thumbnail_url: meta.thumbnailUrl,
      duration_seconds: meta.durationSeconds,
      published_at: meta.publishedAt,
      has_transcript: false,
      review_status: 'approved',
    } as any, { onConflict: 'youtube_id' }).select('id').single();
    if (vErr || !video) throw vErr || new Error('video upsert failed');
    const videoDbId = (video as any).id;

    // 4. Transcript
    const transcript = await getTranscript(videoId);
    if (!transcript) {
      // No usable transcript → not searchable. Mark rejected so it isn't counted
      // as an approved/live video or listed on the management page.
      await supabase.from('videos').update({
        review_status: 'rejected', relevance_reason: 'Kein DE/EN-Transkript verfügbar',
      } as any).eq('id', videoDbId);
      return { videoId, status: 'no_transcript', segments: 0, title: meta.title, official_status };
    }
    const fullText = transcript.segments.map(s => s.text).join(' ');

    // 5. Relevance gate BEFORE embedding
    const gate = await gateVideo(meta.title, meta.description, fullText);
    if (!gate.relevant) {
      await supabase.from('videos').update({
        review_status: 'rejected',
        relevance_score: gate.score,
        relevance_reason: gate.reason,
        content_type: gate.contentType,
        has_transcript: false,
      } as any).eq('id', videoDbId);
      return { videoId, status: 'rejected_irrelevant', segments: 0, title: meta.title, score: gate.score, reason: gate.reason, official_status };
    }

    // 6. Full ingest
    await supabase.from('segments').delete().eq('video_id', videoDbId);
    await supabase.from('transcripts').delete().eq('video_id', videoDbId);

    const { data: tRow, error: tErr } = await supabase.from('transcripts').insert({
      video_id: videoDbId,
      full_text: fullText,
      language: transcript.language,
      source_type: 'unknown',
    } as any).select('id').single();
    if (tErr || !tRow) throw tErr || new Error('transcript insert failed');

    await supabase.from('videos').update({ has_transcript: true } as any).eq('id', videoDbId);

    const chunks = chunkTranscript(transcript.segments);
    if (!chunks.length) {
      await supabase.from('videos').update({
        review_status: 'rejected', relevance_reason: 'Leeres Transkript',
      } as any).eq('id', videoDbId);
      return { videoId, status: 'no_transcript', segments: 0, title: meta.title, official_status };
    }

    const texts = chunks.map(c => c.text);
    const [embeddings, summaries] = await Promise.all([embed(texts), generateSummaries(texts)]);

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

    // Persist gate verdict; review_status stays 'approved' (auto-live).
    await supabase.from('videos').update({
      relevance_score: gate.score,
      relevance_reason: gate.reason,
      content_type: gate.contentType,
    } as any).eq('id', videoDbId);

    return { videoId, status: 'success', segments: chunks.length, title: meta.title, score: gate.score, official_status };
  } catch (e: any) {
    return { videoId, status: 'error', segments: 0, error: e?.message || String(e) };
  }
}

// ============================================================
// Discovery
// ============================================================

async function getKnownYoutubeIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from('videos').select('youtube_id').range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as { youtube_id: string }[];
    for (const r of rows) ids.add(r.youtube_id);
    if (rows.length < pageSize) break;
  }
  return ids;
}

// Auto-discover community channels (integrators/trainers) via channel search and
// return their upload video IDs. Only channels NOT classified as official are kept,
// so this is the highest-yield source of genuine community videos.
async function discoverCommunityChannelVideos(): Promise<string[]> {
  const seenChannels = new Set<string>();
  const ids: string[] = [];
  for (const q of COMMUNITY_CHANNEL_SEARCH_QUERIES) {
    try {
      const res = await youtube.search.list({ part: ['snippet'], q, type: ['channel'], maxResults: 10 });
      for (const item of res.data.items ?? []) {
        const channelId = item.id?.channelId;
        const name = item.snippet?.title || '';
        if (!channelId || seenChannels.has(channelId)) continue;
        seenChannels.add(channelId);
        if (classifyChannel(name) !== 'community') continue; // skip official Festo channels
        const vids = await fetchChannelVideoIds(channelId, MAX_VIDEOS_PER_CHANNEL);
        vids.forEach(v => ids.push(v));
        console.log(`  community channel "${name}": ${vids.length} videos`);
      }
    } catch (e: any) {
      console.warn(`  ! Channel search "${q}" failed: ${e?.message}`);
    }
  }
  return ids;
}

// Returns candidate video IDs in priority order: auto-discovered community
// channels first (most community videos), then curated channels, then keyword
// search (which also surfaces official content). Order matters because the main
// loop stops once the community target is hit.
async function discoverCandidates(): Promise<string[]> {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => { if (id && !seen.has(id)) { seen.add(id); ordered.push(id); } };

  // a) Auto-discovered community channels — first
  console.log('  · auto-discovering community channels...');
  for (const id of await discoverCommunityChannelVideos()) add(id);

  // b) Curated community channels
  for (const handle of COMMUNITY_CHANNEL_HANDLES) {
    try {
      const channelId = await resolveChannelId(handle);
      if (!channelId) { console.warn(`  ! Could not resolve channel: ${handle}`); continue; }
      const channelVideos = await fetchChannelVideoIds(channelId, MAX_VIDEOS_PER_CHANNEL);
      channelVideos.forEach(add);
      console.log(`  channel ${handle}: ${channelVideos.length} videos`);
    } catch (e: any) {
      console.warn(`  ! Channel ${handle} failed: ${e?.message}`);
    }
  }

  // c) Keyword video search (official + community)
  for (const { q, lang } of FESTO_SEARCH_QUERIES) {
    try {
      const found = await searchVideoIds(q, lang, MAX_PER_QUERY);
      found.forEach(add);
      console.log(`  search "${q}" [${lang}]: ${found.length} videos`);
    } catch (e: any) {
      console.warn(`  ! Search "${q}" failed: ${e?.message}`);
    }
  }

  return ordered;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== Community Video Discovery & Ingestion ===\n');
  console.log(`Target: ${TARGET_LABEL} new community videos | per-query ${MAX_PER_QUERY}, per-channel ${MAX_VIDEOS_PER_CHANNEL}\n`);

  console.log('1. Discovering candidates...');
  const discovered = await discoverCandidates();
  console.log(`\n   Discovered ${discovered.length} unique candidate videos.`);

  console.log('2. Deduplicating against DB...');
  const known = await getKnownYoutubeIds();
  const todo = discovered.filter(id => !known.has(id));
  console.log(`   ${known.size} already known; ${todo.length} new to evaluate.\n`);

  if (!todo.length) { console.log('Nothing new to ingest.'); return; }

  const results: Result[] = [];
  const startTime = Date.now();
  let communityLive = 0;
  let processed = 0;

  // Process until the community target is reached (early stop saves quota/credits).
  for (let i = 0; i < todo.length && communityLive < TARGET_COMMUNITY_VIDEOS; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(id => ingestVideo(id)));
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      processed++;
      if (r.status === 'fulfilled') {
        const v = r.value;
        if (v.status === 'success' && v.official_status === 'community') communityLive++;
        const icon = v.status === 'success' ? '+'
          : v.status === 'rejected_irrelevant' ? 'x'
          : v.status === 'skipped_prefilter' ? 'p'
          : v.status === 'no_transcript' ? '-' : '!';
        const tag = v.official_status ? `, ${v.official_status}` : '';
        const extra = v.status === 'success' ? ` (${v.segments} seg, score ${v.score}${tag})`
          : v.status === 'rejected_irrelevant' ? ` (score ${v.score}: ${v.reason})`
          : v.error ? ` ERR: ${v.error}` : '';
        console.log(`[${communityLive}/${TARGET_LABEL} comm | #${processed}] ${icon} ${v.videoId} — ${v.status}${extra}${v.title ? ` "${v.title}"` : ''}`);
        results.push(v);
      } else {
        console.error(`[#${processed}] ! ${batch[j]} — FATAL: ${r.reason}`);
        results.push({ videoId: batch[j], status: 'error', segments: 0, error: String(r.reason) });
      }
    }
    if (communityLive < TARGET_COMMUNITY_VIDEOS && i + CONCURRENCY < todo.length) await sleep(300);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const by = (s: Status) => results.filter(r => r.status === s);
  const segs = results.reduce((s, r) => s + r.segments, 0);
  const officialLive = by('success').filter(r => r.official_status === 'official').length;

  console.log(`\n=== DONE (${elapsed}s) ===`);
  console.log(`Community videos added (live):  ${communityLive} / ${TARGET_LABEL}`);
  console.log(`Official videos also added:     ${officialLive}`);
  console.log(`Total live (ingested):          ${by('success').length} videos, ${segs} segments`);
  console.log(`Rejected by gate:               ${by('rejected_irrelevant').length}`);
  console.log(`Skipped (metadata prefilter):   ${by('skipped_prefilter').length}`);
  console.log(`No DE/EN transcript:            ${by('no_transcript').length}`);
  console.log(`Errors:                         ${by('error').length}`);
  console.log(`Candidates evaluated:           ${processed} / ${todo.length}`);

  if (!Number.isFinite(TARGET_COMMUNITY_VIDEOS)) {
    console.log(`\nEvaluated all ${processed} candidates — matching videos are now live in search.`);
  } else if (communityLive < TARGET_COMMUNITY_VIDEOS) {
    console.log(`\n! Candidate pool exhausted before reaching the target.`);
    console.log(`  Add terms to COMMUNITY_CHANNEL_SEARCH_QUERIES / FESTO_SEARCH_QUERIES or handles to`);
    console.log(`  COMMUNITY_CHANNEL_HANDLES, then run again (known videos are skipped automatically).`);
  } else {
    console.log(`\nReached target — these videos are now live in search.`);
  }
  console.log(`Manage/remove community videos at /admin/review.`);

  if (by('error').length) {
    console.log(`\nFailed:`);
    by('error').forEach(r => console.log(`  ${r.videoId}: ${r.error}`));
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
