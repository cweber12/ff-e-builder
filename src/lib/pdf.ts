type PdfViewport = {
  width: number;
  height: number;
};

type PdfRenderTask = {
  promise: Promise<unknown>;
};

type PdfPageProxy = {
  view: number[];
  rotate: number;
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: { canvas: HTMLCanvasElement; viewport: PdfViewport }) => PdfRenderTask;
  cleanup: () => void;
};

export type PdfPagePreview = {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  thumbnailUrl: string;
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
      const canvas = await renderPageToCanvas(page, viewport);
      const thumbnailUrl = canvas.toDataURL('image/png');

      previews.push({
        pageNumber,
        widthPt,
        heightPt,
        rotation,
        thumbnailUrl,
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

function getPdfPageSize(page: PdfPageProxy) {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = page.view;

  return {
    widthPt: Math.abs(x2 - x1),
    heightPt: Math.abs(y2 - y1),
  };
}

async function renderPageToCanvas(page: PdfPageProxy, viewport: PdfViewport) {
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
