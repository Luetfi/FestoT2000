import type { ParsedQuery } from './types';

// Error code patterns for detection
const ERROR_CODE_PATTERNS = [
  /\bE-?\d{1,5}\b/gi, // matches E123, E-7342, e-123
  /\bFehlercode\s*\d+/gi, // matches "Fehlercode 123"
  /\berror\s*code\s*\d+/gi, // matches "error code 123"
];

// Festo product categories with matching keywords for video filtering
export interface ProductCategory {
  id: string;
  label: string;
  keywords: string[];
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'drives-actuators',
    label: 'Antriebe & Aktuatoren',
    keywords: ['DSBC', 'DSBG', 'DSBF', 'DNC', 'ADN', 'ADNG', 'DFM', 'DGC', 'DGST', 'EGC', 'ELGA', 'EPCO', 'zylinder', 'cylinder', 'actuator', 'aktuator', 'linearantrieb'],
  },
  {
    id: 'motors-drives',
    label: 'Motoren und Antriebsregler',
    keywords: ['CMMT-AS', 'CMMT-ST', 'CMMT-MP', 'EMMT', 'EMME', 'EMMS', 'servo', 'motor', 'antriebsregler', 'drive controller'],
  },
  {
    id: 'grippers',
    label: 'Greifer',
    keywords: ['DHPS', 'EHPS', 'HGPL', 'HGPT', 'HGPP', 'DHEB', 'greifer', 'gripper'],
  },
  {
    id: 'handling-robots',
    label: 'Handlingsysteme und Industrieroboter',
    keywords: ['EXCM', 'EXCT', 'ELGR', 'handling', 'roboter', 'robot', 'portalsystem', 'gantry'],
  },
  {
    id: 'vacuum',
    label: 'Vakuumtechnik',
    keywords: ['OVEM', 'VADM', 'VN-', 'vakuum', 'vacuum', 'sauggreifer', 'suction'],
  },
  {
    id: 'valves',
    label: 'Ventile und Ventilinseln',
    keywords: ['VTUG', 'MPA-S', 'MPA-L', 'VTSA', 'VTOC', 'CPX-GE', 'VSVA', 'VUVG', 'VUVS', 'ventil', 'valve', 'ventilinsel', 'valve terminal'],
  },
  {
    id: 'motion-terminal',
    label: 'Motion Terminal',
    keywords: ['VTEM', 'VAEM', 'motion terminal', 'motion app'],
  },
  {
    id: 'sensors',
    label: 'Sensoren',
    keywords: ['SIEN', 'SPAU', 'SPAN', 'SRBS', 'SME', 'SMT', 'SOEG', 'sensor', 'näherungsschalter', 'proximity', 'drucksensor', 'pressure sensor'],
  },
  {
    id: 'air-preparation',
    label: 'Druckluftaufbereitung',
    keywords: ['MS4', 'MS6', 'MS9', 'MSB', 'LFR', 'LFMA', 'druckluft', 'air preparation', 'wartungseinheit', 'service unit', 'filter regulator'],
  },
  {
    id: 'connection',
    label: 'Verbindungstechnik',
    keywords: ['QS', 'NPQM', 'PUN', 'PAN', 'CRQS', 'schlauch', 'tubing', 'fitting', 'verbindung', 'connection'],
  },
  {
    id: 'controls-remote-io',
    label: 'Steuerungstechnik und Remote I/O',
    keywords: ['CPX', 'CPX-AP', 'CPX-E', 'CECC', 'CECC-X', 'CECX', 'CDPX', 'steuerung', 'controller', 'remote i/o', 'remote io', 'plc', 'sps'],
  },
  {
    id: 'software',
    label: 'Software',
    keywords: ['automation suite', 'festo configuration tool', 'fct', 'handling guide', 'schematic solution', 'positioning drives', 'software'],
  },
  {
    id: 'ready-to-install',
    label: 'Einbaufertige Lösungen',
    keywords: ['einbaufertig', 'ready-to-install', 'ready to install', 'subsystem'],
  },
  {
    id: 'function-specific',
    label: 'Funktionsspezifische Systeme',
    keywords: ['funktionsspezifisch', 'function-specific', 'dispensing', 'dosier', 'press'],
  },
  {
    id: 'other-pneumatic',
    label: 'Sonstige pneumatische Komponenten',
    keywords: ['pneumatik', 'pneumatic', 'schalldämpfer', 'silencer', 'drosselventil', 'flow control'],
  },
  {
    id: 'services',
    label: 'Services',
    keywords: ['service', 'training', 'schulung', 'support', 'wartung', 'maintenance', 'energy saving'],
  },
];

// Flat list of all product keywords (derived from categories) for search query enhancement
export const PRODUCT_KEYWORDS = Array.from(
  new Set(PRODUCT_CATEGORIES.flatMap((c) => c.keywords))
);

/**
 * Parse search query to extract error codes and product keywords
 * Enhances query with detected terms for full-text search boosting
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const errorCodes = new Set<string>();

  // Extract error codes using all patterns
  for (const pattern of ERROR_CODE_PATTERNS) {
    const matches = query.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        // Normalize: uppercase and remove spaces
        const normalized = match.toUpperCase().replace(/\s+/g, '');
        errorCodes.add(normalized);
      });
    }
  }

  // Detect product keywords (case-insensitive substring match)
  const productKeywords = PRODUCT_KEYWORDS.filter((keyword) =>
    query.toUpperCase().includes(keyword.toUpperCase())
  );

  // Build enhanced query by appending detected terms
  let enhancedQuery = query;
  if (errorCodes.size > 0) {
    enhancedQuery += ' ' + Array.from(errorCodes).join(' ');
  }
  if (productKeywords.length > 0) {
    enhancedQuery += ' ' + productKeywords.join(' ');
  }

  return {
    originalQuery: query,
    errorCodes: Array.from(errorCodes),
    productKeywords,
    enhancedQuery,
  };
}
