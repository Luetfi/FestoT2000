-- Mehrsprachige Volltextsuche und zweisprachige Anfrage.
--
-- Problem: Die Anfragen sind deutsch, 28 von 40 Zielvideos haben
-- ein englisches Transkript. Der lexikalische Zweig erreicht auf englischen
-- Transkripten Recall@5 = 7,1 %, auf deutschen 33,3 %; das Gesamtsystem 71,4 %
-- gegenueber 100 %. Alle acht nicht gefundenen Anfragen betreffen englische
-- Transkripte, bei sieben davon fehlte das Ziel schon im Abruf.
--
-- Zwei Ursachen, zwei Gegenmassnahmen:
--
--   1. Volltext: segments.text_tsv ist to_tsvector('german', text) und wird mit
--      websearch_to_tsquery('german', ...) abgefragt - auf englischem Text also
--      mit deutschen Stemming- und Stoppwortregeln. Diese Migration ergaenzt
--      zwei generierte Spalten (english, simple) und sucht im Modus 'multi'
--      ueber alle drei Sichten. Die simple-Sicht ist fuer dieses Korpus
--      wesentlich: Produktkennungen wie CMMT-AS oder CPX-AP-I-EC werden von
--      keinem Stemmer sinnvoll behandelt.
--
--   2. Semantik: Eine deutsche Anfrage und ein englisches Transkript teilen oft
--      gar keine Oberflaechenform ("Inbetriebnahme" / "commissioning"). Das
--      loest keine Volltextkonfiguration, sondern nur der Vektorraum. Die
--      Funktion nimmt deshalb optional eine zweite, uebersetzte Anfrage samt
--      eigener Einbettung entgegen.
--
-- WICHTIG: Mit fts_mode = 'german', query_text_alt = NULL und
-- query_embedding_alt = NULL ist diese Funktion verhaltensgleich zu
-- 008_title_in_search.sql. Die Basiskonfiguration reproduziert damit exakt den
-- vorherigen Stand.
--
-- Gewichtung: Weder die zusaetzlichen Sichten noch die zweite Einbettung
-- erzeugen zusaetzliche RRF-Zweige. Innerhalb der Semantik zaehlt der beste Rang
-- beider Einbettungen, innerhalb des Volltexts der beste Rang aller Sichten. Es
-- bleibt bei genau zwei fusionierten Zweigen mit unveraenderten Gewichten - ein
-- Vergleich misst so, WO gesucht wird, und nicht, wie laut ein Zweig geworden ist.

-- pgvector liegt in diesem Projekt im Schema "extensions"
-- (001_initial_schema.sql: CREATE EXTENSION ... WITH SCHEMA extensions). Die
-- Migrationssitzung der Supabase-CLI hat dieses Schema nicht im Suchpfad, der
-- Typ "vector" und der Operator "<=>" waeren dort also nicht aufloesbar. Im
-- SQL-Editor faellt das nicht auf, weil er extensions mitfuehrt - deshalb
-- fehlte die Zeile in den frueheren, von Hand eingespielten Migrationen.
set search_path = public, extensions;

-- 1. Zusaetzliche Volltext-Sichten -------------------------------------------

ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS text_tsv_en tsvector
    GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;

ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS text_tsv_simple tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED;

CREATE INDEX IF NOT EXISTS segments_text_tsv_en_idx
  ON segments USING GIN (text_tsv_en);

CREATE INDEX IF NOT EXISTS segments_text_tsv_simple_idx
  ON segments USING GIN (text_tsv_simple);

-- 2. Suchfunktion -------------------------------------------------------------

-- Die Signatur aendert sich, CREATE OR REPLACE kann das nicht (Postgres 42P13).
DROP FUNCTION IF EXISTS hybrid_search_segments(text, vector, integer, double precision, double precision, integer);

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
-- Semantik, primaere Anfrage. Innerer LIMIT wie in 008 (match_count * 2), damit
-- die Basiskonfiguration den vorherigen Stand exakt reproduziert.
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
-- Semantik, uebersetzte Anfrage. Leer, solange keine zweite Einbettung uebergeben wird.
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
-- Ein Segment, das beide Einbettungen finden, zaehlt mit seinem besseren Rang -
-- nicht doppelt.
sem AS (
  SELECT u.id, MIN(u.rank_ix) AS rank_ix, MAX(u.similarity) AS similarity
  FROM (
    SELECT id, rank_ix, similarity FROM sem_primary
    UNION ALL
    SELECT id, rank_ix, similarity FROM sem_alt
  ) u
  GROUP BY u.id
),
-- Volltext ueber alle aktiven Sichten. Ein Segment gilt als Treffer, sobald eine
-- Sicht anschlaegt; gewertet wird der beste Rangwert.
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
-- Zwei Zweige, unveraenderte Gewichte. Die Summenform ist rechnerisch identisch
-- zum FULL OUTER JOIN aus 008, aber erweiterbar und lesbarer.
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

GRANT EXECUTE ON FUNCTION hybrid_search_segments TO anon, authenticated;
