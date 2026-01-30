import type { ParsedQuery } from './types';

// Error code patterns for detection
const ERROR_CODE_PATTERNS = [
  /\bE-?\d{1,5}\b/gi, // matches E123, E-7342, e-123
  /\bFehlercode\s*\d+/gi, // matches "Fehlercode 123"
  /\berror\s*code\s*\d+/gi, // matches "error code 123"
];

// Festo product keywords
const PRODUCT_KEYWORDS = [
  'CPX',
  'CMMT-AS',
  'CMMT-ST',
  'VTUG',
  'MPA-S',
  'CECC',
  'CPX-AP',
  'CPX-E',
  'VTEM',
  'VAEM',
];

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
