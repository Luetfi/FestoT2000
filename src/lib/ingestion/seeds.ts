// Seed query definitions for YouTube video discovery - server-only
// Keyword search queries targeting Festo products, problems, and interfaces
import 'server-only';

export interface SeedQuery {
  query: string;
  lang: 'de' | 'en';
}

/**
 * Seed queries for initial video corpus discovery
 * Each query is tagged with a relevanceLanguage to avoid running all queries twice.
 * - German-specific queries → lang: 'de'
 * - English-specific queries → lang: 'en'
 * - Product/interface queries → lang: 'de' (default, finds multilingual content)
 */
export const SEED_QUERIES: SeedQuery[] = [
  // Product families (de — YouTube surfaces both DE and EN results for product names)
  { query: 'Festo CPX', lang: 'de' },
  { query: 'Festo VTUG', lang: 'de' },
  { query: 'Festo MPA', lang: 'de' },
  { query: 'Festo CMMT-AS', lang: 'de' },
  { query: 'Festo CECC', lang: 'de' },
  { query: 'Festo CPX-AP', lang: 'de' },
  { query: 'Festo DSBC', lang: 'de' },
  { query: 'Festo VTEM', lang: 'de' },
  { query: 'Festo EHPS', lang: 'de' },

  // Problems (German)
  { query: 'Festo Druck baut sich nicht auf', lang: 'de' },
  { query: 'Festo startet nicht', lang: 'de' },
  { query: 'Festo Fehlercode', lang: 'de' },
  { query: 'Festo keine Kommunikation', lang: 'de' },
  { query: 'Festo Inbetriebnahme', lang: 'de' },

  // Problems (English)
  { query: 'Festo no pressure', lang: 'en' },
  { query: 'Festo error code', lang: 'en' },
  { query: 'Festo commissioning', lang: 'en' },

  // Interfaces (de — technical terms are universal)
  { query: 'Festo PROFINET', lang: 'de' },
  { query: 'Festo EtherNet/IP', lang: 'de' },
  { query: 'Festo IO-Link', lang: 'de' },

  // Specific combinations
  { query: 'CMMT-AS E123', lang: 'de' },
  { query: 'CPX valve terminal', lang: 'en' },

  // Tutorials & software
  { query: 'Festo Automation Suite', lang: 'de' },
  { query: 'Festo Handling Guide', lang: 'de' },

  // German terms
  { query: 'Festo Wartung', lang: 'de' },
  { query: 'Festo Konfiguration', lang: 'de' },
  { query: 'Festo Pneumatik', lang: 'de' },

  // English tutorials & guides
  { query: 'Festo tutorial English', lang: 'en' },
  { query: 'Festo commissioning guide', lang: 'en' },
  { query: 'Festo servo drive setup', lang: 'en' },
  { query: 'Festo pneumatic troubleshooting', lang: 'en' },
  { query: 'Festo valve terminal configuration', lang: 'en' },

  // English applications
  { query: 'Festo pneumatic cylinder tutorial', lang: 'en' },
  { query: 'Festo servo motor setup', lang: 'en' },
  { query: 'Festo gripper configuration', lang: 'en' },
];
