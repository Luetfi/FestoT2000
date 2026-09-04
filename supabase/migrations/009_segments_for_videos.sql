-- Alle Segmente der Treffervideos fuer die Bestimmung der Sprungstelle.
--
-- Problem: Die Sprungstelle eines Videos war bisher die Startzeit desjenigen
-- Segments, das in der nach Judge-Confidence sortierten Trefferliste als erstes
-- zu diesem Video gehoerte. Damit konnte nur ausgewaehlt werden, was zuvor die
-- RRF-Rangliste ueberstanden hatte - bei median 4,5 Segmenten je Video oft nur
-- ein einziges, und zwar das titelnahe Anfangssegment. Das eigentlich
-- antwortende Segment wurde nie bewertet.
--
-- Messbefund dazu: 14 von 32 Sprungstellen lagen daneben, davon
-- 14 zu frueh und 0 zu spaet, 13 auf dem ersten Segment, Median-Vorlauf 118 s.
--
-- Fix: Diese Funktion liefert JEDES Segment der uebergebenen Videos samt
-- Kosinus-Aehnlichkeit zur Anfrage. Der Segment-Picker
-- (src/lib/search/segment-picker.ts) waehlt daraus die Sprungstelle - getrennt
-- von der Videoauswahl, die weiterhin der titelbewusste Judge trifft.
--
-- Keine ANN-Suche und kein Index noetig: bei 5 Videos sind das rund 25 Zeilen,
-- die ueber segments_video_id_idx (001_initial_schema.sql) gelesen werden. Die
-- Aehnlichkeit wird in der Datenbank berechnet, damit keine 1536-Float-Vektoren
-- ueber die Verbindung wandern.

-- pgvector liegt in diesem Projekt im Schema "extensions"
-- (001_initial_schema.sql: CREATE EXTENSION ... WITH SCHEMA extensions). Die
-- Migrationssitzung der Supabase-CLI hat dieses Schema nicht im Suchpfad, der
-- Typ "vector" und der Operator "<=>" waeren dort also nicht aufloesbar. Im
-- SQL-Editor faellt das nicht auf, weil er extensions mitfuehrt - deshalb
-- fehlte die Zeile in den frueheren, von Hand eingespielten Migrationen.
set search_path = public, extensions;

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
    -- 1-basierte Position im Video. Der Picker braucht sie, um das
    -- Anfangssegment als solches zu erkennen, ohne auf Zeitwerte zu schliessen.
    -- Nicht "position": das ist in Postgres ein Schluesselwort.
    (row_number() OVER (
       PARTITION BY segments.video_id ORDER BY segments.start_time
     ))::int AS segment_position
  FROM segments
  WHERE segments.video_id = ANY(video_ids)
  ORDER BY segments.video_id, segments.start_time;
$$;

GRANT EXECUTE ON FUNCTION segments_for_videos TO anon, authenticated;
