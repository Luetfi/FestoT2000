// Zentrale Suchparameter - server-only
//
// Warum diese Datei existiert: Die Parameter der Suchkette standen bisher an
// zwei Stellen (route.ts, relevance-filter.ts). Fuer Vergleichsmessungen
// muessen einzelne Stufen der Kette gezielt an- und abgeschaltet werden, ohne
// den Code zwischen zwei Messlaeufen umzubauen - sonst misst man nicht die
// Wirkung einer Massnahme, sondern die Differenz zweier Builds.
//
// Die Ueberschreibung greift ausschliesslich bei ?eval=1 und ist damit nie aus
// dem oeffentlichen Verkehr erreichbar.
import 'server-only';

export type FtsMode = 'german' | 'multi';

export interface SearchConfig {
  /** Kandidaten aus der hybriden Suche (RPC match_count). */
  matchCount: number;
  /** RRF-Konstante k. */
  rrfK: number;
  semanticWeight: number;
  fullTextWeight: number;
  /** Absoluter Vorfilter vor der Relevanzbewertung. */
  minSemanticSimilarity: number;
  /** Mindest-Confidence des titelbewussten Judges (Videoauswahl). */
  minConfidence: number;
  /** Hoechstzahl distinkter Videos in der Trefferliste. */
  maxVideoGroups: number;
  /** Volltextzweig: nur deutsche Konfiguration oder zusaetzlich english/simple. */
  ftsMode: FtsMode;
  /** Anfrage zusaetzlich uebersetzt einbetten und mitsuchen. */
  bilingualQuery: boolean;
  /** Sprungstelle ueber alle Segmente des Videos bestimmen statt ueber die Trefferliste. */
  segmentPicker: boolean;
}

/**
 * Auslieferungszustand. Aenderungen hier wirken auf die Suche und - weil
 * Vergleichsmessungen ueber /api/search laufen - unmittelbar auf die Messung.
 */
export const PRODUCTION_SEARCH_CONFIG: SearchConfig = {
  matchCount: 60,
  rrfK: 50,
  semanticWeight: 1.5,
  fullTextWeight: 1.0,
  minSemanticSimilarity: 0.3,
  minConfidence: 50,
  maxVideoGroups: 5,
  ftsMode: 'multi',
  bilingualQuery: true,
  segmentPicker: true,
};

/**
 * Stand vor den Suchverbesserungen (mehrsprachige Suche, Segment-Picker,
 * groesserer Kandidatenpool). Dient als Vergleichsbasis fuer Messungen.
 */
export const BASELINE_SEARCH_CONFIG: SearchConfig = {
  ...PRODUCTION_SEARCH_CONFIG,
  matchCount: 30,
  ftsMode: 'german',
  bilingualQuery: false,
  segmentPicker: false,
};

function num(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function bool(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  return raw === '1' || raw === 'true';
}

/**
 * Konfiguration einer Anfrage bestimmen.
 *
 * Ohne ?eval=1 gilt ausnahmslos der Auslieferungszustand - Suchparameter sind
 * damit nicht von aussen manipulierbar. Mit ?eval=1 dient `stufe=baseline` als
 * Ausgangspunkt, den einzelne Parameter weiter ueberschreiben koennen; so laesst
 * sich jede Suchstufe einzeln zuschalten.
 */
export function resolveSearchConfig(params: URLSearchParams): SearchConfig {
  if (params.get('eval') !== '1') return PRODUCTION_SEARCH_CONFIG;

  const base =
    params.get('stufe') === 'baseline' ? BASELINE_SEARCH_CONFIG : PRODUCTION_SEARCH_CONFIG;

  const ftsRaw = params.get('ftsMode');
  return {
    ...base,
    matchCount: Math.round(num(params.get('matchCount'), base.matchCount, 1, 200)),
    minConfidence: num(params.get('minConfidence'), base.minConfidence, 0, 100),
    ftsMode: ftsRaw === 'german' || ftsRaw === 'multi' ? ftsRaw : base.ftsMode,
    bilingualQuery: bool(params.get('bilingualQuery'), base.bilingualQuery),
    segmentPicker: bool(params.get('segmentPicker'), base.segmentPicker),
  };
}
