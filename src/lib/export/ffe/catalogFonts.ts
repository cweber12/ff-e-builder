import type jsPDF from 'jspdf';
import sourceSansRegularUrl from '../../../assets/fonts/SourceSans3-Regular.ttf?url';
import sourceSansBoldUrl from '../../../assets/fonts/SourceSans3-Bold.ttf?url';

export const CATALOG_FONT = 'SourceSans3';

type FontFile = { url: string; vfsName: string; style: 'normal' | 'bold' };

const FONT_FILES: FontFile[] = [
  { url: sourceSansRegularUrl, vfsName: 'SourceSans3-Regular.ttf', style: 'normal' },
  { url: sourceSansBoldUrl, vfsName: 'SourceSans3-Bold.ttf', style: 'bold' },
];

let cachedBase64: Record<string, string> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch font ${url}: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadFontPayloads(): Promise<Record<string, string>> {
  if (cachedBase64) return cachedBase64;
  const entries = await Promise.all(
    FONT_FILES.map(async (file) => [file.vfsName, await fetchAsBase64(file.url)] as const),
  );
  cachedBase64 = Object.fromEntries(entries);
  return cachedBase64;
}

/**
 * Registers Source Sans 3 (regular + bold) with the jsPDF document so it can be
 * selected via `doc.setFont(CATALOG_FONT, weight)`. Falls back to helvetica on
 * failure so PDFs still render even if the TTF cannot be fetched.
 */
export async function registerCatalogFonts(doc: jsPDF): Promise<string> {
  try {
    const payloads = await loadFontPayloads();
    for (const file of FONT_FILES) {
      doc.addFileToVFS(file.vfsName, payloads[file.vfsName]!);
      doc.addFont(file.vfsName, CATALOG_FONT, file.style);
    }
    return CATALOG_FONT;
  } catch (error) {
    console.warn('catalog pdf: falling back to helvetica', error);
    return 'helvetica';
  }
}
