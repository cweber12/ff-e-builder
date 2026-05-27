export type RGB = [number, number, number];

export type CatalogColorToken = 'ink-950' | 'ink-800' | 'slate-700';
export type CatalogImageAlignment = 'center' | 'top';
export type CatalogPlanImageSize = 'thumbnail' | 'expanded';

const INK_950: RGB = [10, 10, 10]; // #0a0a0a
const INK_800: RGB = [38, 38, 38]; // #262626
const SLATE_700: RGB = [55, 65, 81]; // #374151

export function resolveCatalogColorToken(token: CatalogColorToken): string {
  switch (token) {
    case 'ink-950':
      return '#0a0a0a';
    case 'ink-800':
      return '#262626';
    case 'slate-700':
      return '#374151';
    default:
      return '#0a0a0a';
  }
}

export function resolveColorToken(token: CatalogColorToken): RGB {
  switch (token) {
    case 'ink-950':
      return INK_950;
    case 'ink-800':
      return INK_800;
    case 'slate-700':
      return SLATE_700;
  }
}
