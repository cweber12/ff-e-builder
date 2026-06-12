import type { PageViewport, PDFPageProxy } from 'pdfjs-dist';

export type PdfPagePreview = {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  thumbnailUrl: string;
  detectedSheetReference?: string;
};

export type RenderedPdfPage = {
  file: File;
  pageNumber: number;
  pageWidthPt: number;
  pageHeightPt: number;
  rotation: number;
  renderScale: number;
  renderedWidthPx: number;
  renderedHeightPx: number;
};

export async function renderPdfThumbnails(
  file: File,
  scale = 0.2,
  maxPages = 80,
): Promise<PdfPagePreview[]> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  try {
    if (pdf.numPages > maxPages) {
      throw new Error(`PDFs are limited to ${maxPages} pages for this first version.`);
    }

    const previews: PdfPagePreview[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const { widthPt, heightPt } = getPdfPageSize(page);
      const rotation = page.rotate;
      const textContent = await page.getTextContent();
      const detectedSheetReference = detectSheetReferenceFromTextItems(
        textContent.items,
        viewport.width,
        viewport.height,
      );
      const canvas = await renderPageToCanvas(page, viewport);
      const thumbnailUrl = canvas.toDataURL('image/png');

      previews.push({
        pageNumber,
        widthPt,
        heightPt,
        rotation,
        thumbnailUrl,
        ...(detectedSheetReference ? { detectedSheetReference } : {}),
      });
      page.cleanup();
    }

    return previews;
  } finally {
    await pdf.destroy();
  }
}

export async function renderPdfPageAsPngFile({
  file,
  pageNumber,
  filename,
  scale = 2,
}: {
  file: File;
  pageNumber: number;
  filename: string;
  scale?: number;
}): Promise<RenderedPdfPage> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  try {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const { widthPt: pageWidthPt, heightPt: pageHeightPt } = getPdfPageSize(page);
    const rotation = page.rotate;
    const canvas = await renderPageToCanvas(page, viewport);
    const blob = await canvasToBlob(canvas);
    page.cleanup();

    return {
      file: new File([blob], filename, { type: 'image/png' }),
      pageNumber,
      pageWidthPt,
      pageHeightPt,
      rotation,
      renderScale: scale,
      renderedWidthPx: canvas.width,
      renderedHeightPx: canvas.height,
    };
  } finally {
    await pdf.destroy();
  }
}

let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.mjs?url'),
    ]).then(([pdfjs, workerModule]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjs;
    });
  }

  return pdfJsPromise;
}

function getPdfPageSize(page: PDFPageProxy) {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = page.view;

  return {
    widthPt: Math.abs(x2 - x1),
    heightPt: Math.abs(y2 - y1),
  };
}

async function renderPageToCanvas(page: PDFPageProxy, viewport: PageViewport) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not render PDF page image.'));
      }
    }, 'image/png');
  });
}

type PdfTextItemLike = {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
};

type PositionedText = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const SHEET_REFERENCE_PATTERN = /\b[A-Z]{1,3}\d{1,3}(?:[.-]\d{1,3}){1,2}[A-Z]?\b/g;

export function detectSheetReferenceFromTextItems(
  rawItems: unknown[],
  pageWidth: number,
  pageHeight: number,
): string | null {
  if (pageWidth <= 0 || pageHeight <= 0) return null;

  const items = rawItems.flatMap(toPositionedTextItem);
  const candidates = [...findTextCandidates(items), ...findLineCandidates(items)];
  const scoredCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreSheetReferenceCandidate(candidate, pageWidth, pageHeight),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));

  return scoredCandidates[0]?.value ?? null;
}

function toPositionedTextItem(rawItem: unknown): PositionedText[] {
  const item = rawItem as PdfTextItemLike;
  if (typeof item.str !== 'string' || item.str.trim().length === 0) return [];
  if (!Array.isArray(item.transform) || item.transform.length < 6) return [];

  const x = Number(item.transform[4]);
  const y = Number(item.transform[5]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];

  const width = typeof item.width === 'number' && Number.isFinite(item.width) ? item.width : 0;
  const height = typeof item.height === 'number' && Number.isFinite(item.height) ? item.height : 0;

  return [
    {
      text: item.str.trim(),
      x,
      y,
      width,
      height,
    },
  ];
}

function findTextCandidates(items: PositionedText[]) {
  return items.flatMap((item) =>
    extractSheetReferenceValues(item.text).map((value) => ({
      value,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      isExactItem: item.text.trim().toUpperCase() === value,
    })),
  );
}

function findLineCandidates(items: PositionedText[]) {
  const lines = groupTextItemsIntoLines(items);

  return lines.flatMap((line) => {
    const text = line
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(' ');
    const minX = Math.min(...line.map((item) => item.x));
    const maxX = Math.max(...line.map((item) => item.x + item.width));
    const minY = Math.min(...line.map((item) => item.y));
    const maxY = Math.max(...line.map((item) => item.y + item.height));

    return extractSheetReferenceValues(text).map((value) => ({
      value,
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
      isExactItem: false,
    }));
  });
}

function groupTextItemsIntoLines(items: PositionedText[]) {
  const lineTolerance = 8;
  const lines: PositionedText[][] = [];

  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const line = lines.find((candidate) => {
      const firstItem = candidate[0];
      return firstItem ? Math.abs(firstItem.y - item.y) <= lineTolerance : false;
    });
    if (line) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines;
}

function extractSheetReferenceValues(text: string) {
  const compactText = text
    .toUpperCase()
    .replace(/\s*([.-])\s*/g, '$1')
    .replace(/\s+/g, ' ');

  return Array.from(new Set(compactText.match(SHEET_REFERENCE_PATTERN) ?? []));
}

function scoreSheetReferenceCandidate(
  candidate: {
    x: number;
    y: number;
    width: number;
    isExactItem: boolean;
  },
  pageWidth: number,
  pageHeight: number,
) {
  const xCenter = (candidate.x + candidate.width / 2) / pageWidth;
  const yPosition = candidate.y / pageHeight;
  const isLowerTitleBlockBand = yPosition <= 0.28;
  const isSideTitleBlockBand = xCenter <= 0.25 || xCenter >= 0.62;

  if (!isLowerTitleBlockBand || !isSideTitleBlockBand) return 0;

  return (
    100 + (1 - yPosition) * 20 + (isSideTitleBlockBand ? 20 : 0) + (candidate.isExactItem ? 10 : 0)
  );
}
