-- User feedback + coverage-gap tracking
-- Two grains of signal, both written server-side (service role):
--   1. video_feedback: per-video thumbs up/down, either tied to a search hit
--      (feedback_type = 'search_result') or an editorial "does this video fit"
--      judgement on the detail page (feedback_type = 'video').
--   2. query_log: one row per search, auto-logged by the search API, plus an
--      optional explicit "did your search get solved?" answer. Lets an editor
--      spot queries that stay unanswered and feed a matching video for them.

-- 1. Per-video feedback
CREATE TABLE IF NOT EXISTS video_feedback (
  id            BIGSERIAL PRIMARY KEY,
  video_id      BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  segment_id    BIGINT REFERENCES segments(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('search_result', 'video')),
  is_positive   BOOLEAN NOT NULL,
  -- '' (not NULL) when there is no query context, so the unique constraint below
  -- treats "no query" as a single distinct value (NULLs are distinct in Postgres).
  query         TEXT NOT NULL DEFAULT '',
  reason        TEXT,
  lang          TEXT,
  session_id    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One vote per (session, video, type, query). A re-click upserts (flips the
  -- thumb / updates the reason) instead of stacking duplicate rows. Named
  -- constraint so PostgREST can target it via on_conflict.
  CONSTRAINT uq_video_feedback_dedup UNIQUE (session_id, video_id, feedback_type, query)
);

CREATE INDEX IF NOT EXISTS idx_video_feedback_video ON video_feedback(video_id);

-- Enable RLS with NO policies: anon/authenticated keys get zero access, while the
-- service-role client (the only writer/reader, in the API routes) bypasses RLS.
ALTER TABLE video_feedback ENABLE ROW LEVEL SECURITY;

-- 2. Per-search log + coverage-gap signal
CREATE TABLE IF NOT EXISTS query_log (
  id               BIGSERIAL PRIMARY KEY,
  query            TEXT NOT NULL,
  normalized_query TEXT GENERATED ALWAYS AS (lower(btrim(query))) STORED,
  lang             TEXT,
  result_count     INTEGER NOT NULL,
  top_confidence   INTEGER,
  was_solved       BOOLEAN,
  session_id       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_log_normalized ON query_log(normalized_query);
CREATE INDEX IF NOT EXISTS idx_query_log_created ON query_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_log_gap
  ON query_log(normalized_query)
  WHERE was_solved IS FALSE OR result_count = 0;

-- Same RLS posture as video_feedback: service-role only.
ALTER TABLE query_log ENABLE ROW LEVEL SECURITY;

-- 3. Aggregation views for the admin screens.

-- Per-video feedback totals -> shown on /admin/review.
-- security_invoker so the view respects the caller's RLS (anon sees nothing,
-- service-role sees everything) instead of running as the view owner.
CREATE OR REPLACE VIEW video_feedback_stats WITH (security_invoker = true) AS
SELECT video_id,
       count(*) FILTER (WHERE is_positive)     AS positive_count,
       count(*) FILTER (WHERE NOT is_positive) AS negative_count,
       max(created_at)                         AS last_feedback_at
FROM video_feedback
GROUP BY video_id;

-- Coverage gaps grouped by normalized query -> shown on /admin/gaps.
-- A query surfaces if users marked it unsolved, it ever returned zero results,
-- or the best confidence ever seen for it stayed weak (< 60).
CREATE OR REPLACE VIEW query_gaps WITH (security_invoker = true) AS
SELECT normalized_query,
       max(query)                                  AS sample_query,
       count(*)                                    AS search_count,
       count(*) FILTER (WHERE was_solved IS FALSE) AS unsolved_count,
       count(*) FILTER (WHERE result_count = 0)    AS zero_result_count,
       round(avg(result_count))                    AS avg_results,
       max(top_confidence)                         AS best_confidence_seen,
       max(created_at)                             AS last_searched_at
FROM query_log
GROUP BY normalized_query
HAVING count(*) FILTER (WHERE was_solved IS FALSE) > 0
    OR count(*) FILTER (WHERE result_count = 0)    > 0
    OR COALESCE(max(top_confidence), 0) < 60;

-- The admin screens read these views through the service-role client only, so
-- strip the default anon/authenticated grants Supabase adds to new objects.
REVOKE ALL ON video_feedback_stats, query_gaps FROM anon, authenticated;
