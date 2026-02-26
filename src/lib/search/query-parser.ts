import type { ParsedQuery } from './types';
import {
  FESTO_PRODUCTS,
  FESTO_CATEGORIES,
  findMatchingProducts,
  findMatchingCategories,
  type FestoProduct,
  type FestoProductCategory,
} from './festo-products';

// Error code patterns for detection
const ERROR_CODE_PATTERNS = [
  /\bE-?\d{1,5}\b/gi, // matches E123, E-7342, e-123
  /\bFehlercode\s*\d+/gi, // matches "Fehlercode 123"
  /\berror\s*code\s*\d+/gi, // matches "error code 123"
];

// Re-export product categories for backward compatibility
export interface ProductCategory {
  id: string;
  label: string;
  keywords: string[];
}

/** Backward-compatible PRODUCT_CATEGORIES derived from FESTO_CATEGORIES */
export const PRODUCT_CATEGORIES: ProductCategory[] = FESTO_CATEGORIES.map((cat) => ({
  id: cat.id,
  label: cat.label_de,
  keywords: [
    ...cat.keywords,
    // Include all product type designations in this category
    ...FESTO_PRODUCTS.filter((p) => p.category === cat.id).flatMap((p) => [
      p.type,
      ...p.synonyms.filter((s) => s.length >= 3 && /^[A-Z]/.test(s)),
    ]),
  ],
}));

/**
 * Flat list of all product keywords for search query enhancement.
 * Now includes all product type designations from the comprehensive database.
 */
export const PRODUCT_KEYWORDS: string[] = Array.from(
  new Set([
    // All product type designations
    ...FESTO_PRODUCTS.map((p) => p.type),
    // All category keywords
    ...FESTO_CATEGORIES.flatMap((c) => c.keywords),
  ])
);

/**
 * Parse search query to extract error codes, product matches, and enhance query.
 *
 * Uses the comprehensive Festo product database with 180+ products for
 * accurate matching. Detects product type designations (DSBC, CMMT, CPX, etc.)
 * and enhances the query with related terms for better full-text search results.
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

  // Find matching products from the comprehensive database
  const matchedProducts = findMatchingProducts(query);

  // Find matching categories
  const matchedCategories = findMatchingCategories(query);

  // Collect all matched product keywords (type designations)
  const productKeywords = [
    ...matchedProducts.map((p) => p.type),
    ...detectCategoryKeywords(query),
  ];

  // Deduplicate
  const uniqueProductKeywords = Array.from(new Set(productKeywords));

  // Build enhanced query with related terms for better full-text matching
  let enhancedQuery = query;

  if (errorCodes.size > 0) {
    enhancedQuery += ' ' + Array.from(errorCodes).join(' ');
  }

  if (matchedProducts.length > 0) {
    // Add product names (both DE and EN) for broader matching
    const relatedTerms = matchedProducts.flatMap((p) => [
      p.type,
      p.name_de,
      p.name_en,
    ]);
    enhancedQuery += ' ' + relatedTerms.join(' ');
  }

  if (matchedCategories.length > 0 && matchedProducts.length === 0) {
    // Only add category keywords when no specific product was matched
    const categoryTerms = matchedCategories.flatMap((c) => c.keywords.slice(0, 3));
    enhancedQuery += ' ' + categoryTerms.join(' ');
  }

  return {
    originalQuery: query,
    errorCodes: Array.from(errorCodes),
    productKeywords: uniqueProductKeywords,
    enhancedQuery,
  };
}

/**
 * Detect category-level keywords in the query.
 * These are general terms like "zylinder", "ventil", "sensor" that indicate
 * a product category without specifying a specific product type.
 */
function detectCategoryKeywords(query: string): string[] {
  const queryLower = query.toLowerCase();
  const matches: string[] = [];

  for (const category of FESTO_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (queryLower.includes(keyword.toLowerCase()) && keyword.length >= 3) {
        matches.push(keyword);
      }
    }
  }

  return matches;
}

// Re-export product database helpers for use in other modules
export { findMatchingProducts, findMatchingCategories, FESTO_PRODUCTS, FESTO_CATEGORIES };
export type { FestoProduct, FestoProductCategory };
