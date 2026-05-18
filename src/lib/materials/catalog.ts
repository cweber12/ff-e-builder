/**
 * Known-product catalog for the Finish Library lookup workflow.
 *
 * Each entry pairs a manufacturer product URL with the metadata fields the
 * Finish Library cares about (name, manufacturer, product description, ID).
 * The lookup helpers below let the form pre-fill from either a full URL or
 * the numeric product code embedded in the URL ("the digits after the 0").
 *
 * Image data is intentionally NOT stored here — we only reference the product
 * page externally via `sourceUrl`. To extend, add more entries below or add
 * adapters for other manufacturers.
 */

export type CatalogEntry = {
  manufacturer: string;
  productLine: string;
  /** Numeric product ID without leading zero (matches material_id in DB). */
  materialId: string;
  /** Code as it appears in the URL path (with leading zero). */
  urlCode: string;
  name: string;
  category: string;
  sourceUrl: string;
};

export const productCatalog: readonly CatalogEntry[] = [
  {
    manufacturer: 'Formica',
    productLine: 'Formica® Laminate - Commercial',
    materialId: '7197',
    urlCode: '07197',
    name: 'Dover White',
    category: 'Solid Colors',
    sourceUrl: 'https://www.formica.com/en-us/products/lamtrade/07197',
  },
  {
    manufacturer: 'Formica',
    productLine: 'Formica® Laminate - Commercial',
    materialId: '9476',
    urlCode: '09476',
    name: 'White Ice Granite',
    category: 'Stones',
    sourceUrl: 'https://www.formica.com/en-us/products/lamtrade/09476',
  },
  {
    manufacturer: 'Formica',
    productLine: 'Formica® Laminate - Commercial',
    materialId: '9288',
    urlCode: '09288',
    name: 'Kona',
    category: 'Woodgrains',
    sourceUrl: 'https://www.formica.com/en-us/products/lamtrade/09288',
  },
  {
    manufacturer: 'Formica',
    productLine: 'Formica® Laminate - Commercial',
    materialId: '8844',
    urlCode: '08844',
    name: 'Aged Ash',
    category: 'Woodgrains',
    sourceUrl: 'https://www.formica.com/en-us/products/lamtrade/08844',
  },
  {
    manufacturer: 'Formica',
    productLine: 'Formica® Laminate - Commercial',
    materialId: '9293',
    urlCode: '09293',
    name: 'Wild Cherry Cross Grain',
    category: 'Woodgrains',
    sourceUrl: 'https://www.formica.com/en-us/products/lamtrade/09293',
  },
  {
    manufacturer: 'Formica',
    productLine: 'Formica® Laminate - Commercial',
    materialId: '3485',
    urlCode: '03485',
    name: 'Black Walnut',
    category: 'Woodgrains',
    sourceUrl: 'https://www.formica.com/en-us/products/lamtrade/03485',
  },
  {
    manufacturer: 'Formica',
    productLine: 'Formica® Laminate - Commercial',
    materialId: '8919',
    urlCode: '08919',
    name: 'Bronzed Steel',
    category: 'Patterns',
    sourceUrl: 'https://www.formica.com/en-us/products/lamtrade/08919',
  },
  {
    manufacturer: 'Formica',
    productLine: 'Formica® Laminate - Commercial',
    materialId: '6212',
    urlCode: '06212',
    name: 'Wheat Strand',
    category: 'Patterns',
    sourceUrl: 'https://www.formica.com/en-us/products/lamtrade/06212',
  },
];

/**
 * Strip a manufacturer URL down to its numeric product code (leading zero
 * preserved). Returns null if no recognisable code is found.
 *
 * Examples:
 *   "https://www.formica.com/en-us/products/lamtrade/07197" -> "07197"
 *   "07197" -> "07197"
 *   "7197"  -> "07197"  (zero-padded to 5 digits)
 */
export function extractProductCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct digit string? Pad to 5 chars to match urlCode format.
  if (/^\d{4,5}$/.test(trimmed)) {
    return trimmed.padStart(5, '0');
  }

  // Pull the last numeric segment from a URL path.
  const match = trimmed.match(/(\d{4,6})(?=\/?$|[?#])/);
  return match?.[1] ? match[1].padStart(5, '0') : null;
}

/**
 * Look up a catalog entry by product URL, urlCode (with leading 0),
 * or materialId (without leading 0). Case-insensitive on URLs.
 */
export function lookupCatalogEntry(input: string): CatalogEntry | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const normalizedUrl = trimmed.toLowerCase();
  const byUrl = productCatalog.find((entry) => entry.sourceUrl.toLowerCase() === normalizedUrl);
  if (byUrl) return byUrl;

  const code = extractProductCode(trimmed);
  if (code) {
    const byCode = productCatalog.find(
      (entry) => entry.urlCode === code || entry.materialId === code.replace(/^0+/, ''),
    );
    if (byCode) return byCode;
  }

  // Last resort: case-insensitive name match.
  const byName = productCatalog.find((entry) => entry.name.toLowerCase() === trimmed.toLowerCase());
  return byName ?? null;
}

/**
 * Build the human-facing description we persist to the materials table when a
 * catalog match is applied. Keeps it terse — product line + category.
 */
export function describeCatalogEntry(entry: CatalogEntry): string {
  return [entry.productLine, entry.category].filter(Boolean).join(' • ');
}
