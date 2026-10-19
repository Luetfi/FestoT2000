-- Datenbankschema der Festo Video Search fuer ein normales PostgreSQL
-- (lokal per Docker, in AWS als Amazon RDS for PostgreSQL).
--
-- Fasst den Endstand von supabase/migrations/001-010 zusammen. Weggelassen ist
-- nur, was es ausserhalb von Supabase nicht gibt: Row Level Security mit den
-- Rollen anon/authenticated und die zugehoerigen GRANTs. Die App spricht die
-- Datenbank ausschliesslich serverseitig an, wie zuvor ueber den
-- Service-Role-Schluessel, der RLS ohnehin umging.
--
-- Die Suchfunktionen sind unveraendert aus 001, 009 und 010 uebernommen, damit
-- Messungen gegen dieses Schema dieselben Ergebnisse liefern wie gegen Supabase.
--
-- Einspielen: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS vector;

-- Tabellen --------------------------------------------------------------------

CREATE TABLE channels (
  id BIGSERIAL PRIMARY KEY,
  youtube_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  official_status TEXT CHECK (official_status IN ('official', 'community', 'unknown')) DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE videos (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES channels(id) ON DELETE CASCADE,
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  published_at TIMESTAMPTZ,
  has_transcript BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  review_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('approved', 'pending', 'rejected')),
  relevance_score INTEGER,
  relevance_reason TEXT,
  content_type TEXT
);

CREATE TABLE transcripts (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT REFERENCES videos(id) ON DELETE CASCADE,
  full_text TEXT NOT NULL,
  language TEXT DEFAULT 'unknown',
  source_type TEXT CHECK (source_type IN ('manual', 'auto', 'unknown')) DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE segments (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT REFERENCES videos(id) ON DELETE CASCADE,
  transcript_id BIGINT REFERENCES transcripts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  text_tsv tsvector GENERATED ALWAYS AS (to_tsvector('german', text)) STORED,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  embedding vector(1536),  -- text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW(),
  summary TEXT,
  explanation TEXT,
  text_tsv_en tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  text_tsv_simple tsvector GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED
);

CREATE TABLE video_feedback (
  id            BIGSERIAL PRIMARY KEY,
  video_id      BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  segment_id    BIGINT REFERENCES segments(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('search_result', 'video')),
  is_positive   BOOLEAN NOT NULL,
  -- '' statt NULL ohne Anfragekontext, damit die Eindeutigkeit unten greift.
  query         TEXT NOT NULL DEFAULT '',
  reason        TEXT,
  lang          TEXT,
  session_id    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_video_feedback_dedup UNIQUE (session_id, video_id, feedback_type, query)
);

CREATE TABLE query_log (
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

-- Indizes ---------------------------------------------------------------------

CREATE INDEX segments_embedding_idx ON segments USING hnsw (embedding vector_cosine_ops);
CREATE INDEX segments_text_tsv_idx ON segments USING gin (text_tsv);
CREATE INDEX segments_text_tsv_en_idx ON segments USING gin (text_tsv_en);
CREATE INDEX segments_text_tsv_simple_idx ON segments USING gin (text_tsv_simple);
CREATE INDEX segments_video_id_idx ON segments(video_id);
CREATE INDEX videos_youtube_id_idx ON videos(youtube_id);
CREATE INDEX videos_channel_id_idx ON videos(channel_id);
CREATE INDEX idx_videos_review_status ON videos(review_status);
CREATE INDEX idx_video_feedback_video ON video_feedback(video_id);
CREATE INDEX idx_query_log_normalized ON query_log(normalized_query);
CREATE INDEX idx_query_log_created ON query_log(created_at DESC);
CREATE INDEX idx_query_log_gap ON query_log(normalized_query)
  WHERE was_solved IS FALSE OR result_count = 0;

-- updated_at-Trigger ----------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auswertungssichten fuer den Adminbereich (007) ------------------------------

CREATE VIEW video_feedback_stats AS
SELECT video_id,
       count(*) FILTER (WHERE is_positive)     AS positive_count,
       count(*) FILTER (WHERE NOT is_positive) AS negative_count,
       max(created_at)                         AS last_feedback_at
FROM video_feedback
GROUP BY video_id;

CREATE VIEW query_gaps AS
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

-- Reine Vektorsuche (001) -----------------------------------------------------

CREATE OR REPLACE FUNCTION search_segments(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  video_id bigint,
  text text,
  start_time float,
  end_time float,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    segments.id,
    segments.video_id,
    segments.text,
    segments.start_time,
    segments.end_time,
    1 - (segments.embedding <=> query_embedding) AS similarity
  FROM segments
  WHERE segments.embedding IS NOT NULL
    AND 1 - (segments.embedding <=> query_embedding) > match_threshold
  ORDER BY segments.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Segmente der Treffervideos fuer die Sprungstelle (009) ----------------------

CREATE OR REPLACE FUNCTION segments_for_videos(
  video_ids bigint[],
  query_embedding vector(1536)
)
RETURNS TABLE (
  id bigint,
  video_id bigint,
  text text,
  summary text,
  start_time float,
  end_time float,
  similarity float,
  segment_position int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    segments.id,
    segments.video_id,
    segments.text,
    segments.summary,
    segments.start_time,
    segments.end_time,
    CASE
      WHEN segments.embedding IS NULL THEN 0.0::float
      ELSE 1 - (segments.embedding <=> query_embedding)
    END::float AS similarity,
    (row_number() OVER (
       PARTITION BY segments.video_id ORDER BY segments.start_time
     ))::int AS segment_position
  FROM segments
  WHERE segments.video_id = ANY(video_ids)
  ORDER BY segments.video_id, segments.start_time;
$$;

-- Hybride, mehrsprachige Suche (010) ------------------------------------------

CREATE OR REPLACE FUNCTION hybrid_search_segments(
  query_text text,
  query_embedding vector(1536),
  match_count int DEFAULT 20,
  full_text_weight float DEFAULT 1.0,
  semantic_weight float DEFAULT 1.0,
  rrf_k int DEFAULT 50,
  query_text_alt text DEFAULT NULL,
  query_embedding_alt vector(1536) DEFAULT NULL,
  fts_mode text DEFAULT 'german'
)
RETURNS TABLE (
  id bigint,
  video_id bigint,
  text text,
  start_time float,
  end_time float,
  rrf_score float,
  semantic_similarity float,
  full_text_match boolean
)
LANGUAGE sql
STABLE
AS $$
WITH q AS (
  SELECT
    websearch_to_tsquery('german', query_text) AS q_de,
    CASE WHEN fts_mode = 'multi'
         THEN websearch_to_tsquery('english', coalesce(query_text_alt, query_text))
    END AS q_en,
    CASE WHEN fts_mode = 'multi'
         THEN websearch_to_tsquery('simple', query_text)
    END AS q_si
),
sem_primary AS (
  SELECT
    segments.id,
    (1 - (segments.embedding <=> query_embedding))::float AS similarity,
    row_number() OVER (ORDER BY segments.embedding <=> query_embedding) AS rank_ix
  FROM segments
  JOIN videos ON videos.id = segments.video_id
  WHERE segments.embedding IS NOT NULL
    AND videos.review_status = 'approved'
  ORDER BY segments.embedding <=> query_embedding
  LIMIT match_count * 2
),
sem_alt AS (
  SELECT
    segments.id,
    (1 - (segments.embedding <=> query_embedding_alt))::float AS similarity,
    row_number() OVER (ORDER BY segments.embedding <=> query_embedding_alt) AS rank_ix
  FROM segments
  JOIN videos ON videos.id = segments.video_id
  WHERE query_embedding_alt IS NOT NULL
    AND segments.embedding IS NOT NULL
    AND videos.review_status = 'approved'
  ORDER BY segments.embedding <=> query_embedding_alt
  LIMIT match_count * 2
),
sem AS (
  SELECT u.id, MIN(u.rank_ix) AS rank_ix, MAX(u.similarity) AS similarity
  FROM (
    SELECT id, rank_ix, similarity FROM sem_primary
    UNION ALL
    SELECT id, rank_ix, similarity FROM sem_alt
  ) u
  GROUP BY u.id
),
fts AS (
  SELECT
    scored.id,
    row_number() OVER (ORDER BY scored.rank_value DESC) AS rank_ix
  FROM (
    SELECT
      segments.id,
      GREATEST(
        CASE WHEN q.q_de IS NOT NULL AND
                  (segments.text_tsv || to_tsvector('german', coalesce(videos.title, ''))) @@ q.q_de
             THEN ts_rank_cd(segments.text_tsv || to_tsvector('german', coalesce(videos.title, '')), q.q_de)
             ELSE 0 END,
        CASE WHEN q.q_en IS NOT NULL AND
                  (segments.text_tsv_en || to_tsvector('english', coalesce(videos.title, ''))) @@ q.q_en
             THEN ts_rank_cd(segments.text_tsv_en || to_tsvector('english', coalesce(videos.title, '')), q.q_en)
             ELSE 0 END,
        CASE WHEN q.q_si IS NOT NULL AND
                  (segments.text_tsv_simple || to_tsvector('simple', coalesce(videos.title, ''))) @@ q.q_si
             THEN ts_rank_cd(segments.text_tsv_simple || to_tsvector('simple', coalesce(videos.title, '')), q.q_si)
             ELSE 0 END
      ) AS rank_value
    FROM segments
    JOIN videos ON videos.id = segments.video_id
    CROSS JOIN q
    WHERE videos.review_status = 'approved'
      AND (
        (q.q_de IS NOT NULL AND (segments.text_tsv || to_tsvector('german', coalesce(videos.title, ''))) @@ q.q_de)
        OR (q.q_en IS NOT NULL AND (segments.text_tsv_en || to_tsvector('english', coalesce(videos.title, ''))) @@ q.q_en)
        OR (q.q_si IS NOT NULL AND (segments.text_tsv_simple || to_tsvector('simple', coalesce(videos.title, ''))) @@ q.q_si)
      )
  ) scored
  ORDER BY scored.rank_value DESC
  LIMIT match_count * 2
),
fused AS (
  SELECT
    c.id,
    SUM(c.contribution)::float AS rrf_score,
    MAX(c.similarity)::float AS semantic_similarity,
    bool_or(c.is_fts) AS full_text_match
  FROM (
    SELECT sem.id, semantic_weight * (1.0 / (rrf_k + sem.rank_ix)) AS contribution,
           sem.similarity, false AS is_fts
    FROM sem
    UNION ALL
    SELECT fts.id, full_text_weight * (1.0 / (rrf_k + fts.rank_ix)) AS contribution,
           0.0::float AS similarity, true AS is_fts
    FROM fts
  ) c
  GROUP BY c.id
)
SELECT
  segments.id,
  segments.video_id,
  segments.text,
  segments.start_time,
  segments.end_time,
  fused.rrf_score,
  fused.semantic_similarity,
  fused.full_text_match
FROM fused
JOIN segments ON segments.id = fused.id
ORDER BY fused.rrf_score DESC
LIMIT match_count;
$$;
