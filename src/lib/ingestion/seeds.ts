// Seed query definitions for YouTube video discovery - server-only
// Keyword search queries targeting Festo products, problems, and interfaces
import 'server-only';

/**
 * Seed queries for initial video corpus discovery
 * Categories:
 * - Product families: CPX, VTUG, MPA, CMMT-AS, CECC, CPX-AP
 * - Problems: German and English common issues
 * - Interfaces: PROFINET, EtherNet/IP, IO-Link, Modbus
 * - Combinations: Product + specific issues
 */
export const SEED_QUERIES = [
  // Product families
  'Festo CPX',
  'Festo VTUG',
  'Festo MPA',
  'Festo CMMT-AS',
  'Festo CECC',
  'Festo CPX-AP',

  // Problems (German)
  'Festo Druck baut sich nicht auf',
  'Festo startet nicht',
  'Festo Fehlercode',
  'Festo keine Kommunikation',
  'Festo Inbetriebnahme',
  'Festo Homing',

  // Problems (English)
  'Festo no pressure',
  'Festo error code',
  'Festo commissioning',

  // Interfaces
  'Festo PROFINET',
  'Festo EtherNet/IP',
  'Festo IO-Link',
  'Festo Modbus',

  // Specific combinations
  'CMMT-AS E123',
  'CPX valve terminal',
];

/**
 * Get seed queries for video discovery
 * Currently returns static list, but async signature allows
 * future enhancement to fetch from database for dynamic management
 *
 * @returns Array of seed query strings
 */
export async function getSeedQueries(): Promise<string[]> {
  // Future: Fetch from database for admin-configurable queries
  // For MVP, use static list targeting real user problems
  return SEED_QUERIES;
}
