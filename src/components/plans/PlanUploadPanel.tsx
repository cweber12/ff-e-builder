import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateMeasuredPlanInput } from '../../lib/api';
import { renderPdfPageAsPngFile, renderPdfThumbnails, type PdfPagePreview } from '../../lib/pdf';
import { Button } from '../primitives';

type PlanUploadPanelProps = {
  creating: boolean;
  onCreatePlan: (input: CreateMeasuredPlanInput) => Promise<unknown>;
};

const PLAN_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const PLAN_PDF_TYPE = 'application/pdf';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const PDF_RENDER_SCALE = 2;

export function PlanUploadPanel({ creating, onCreatePlan }: PlanUploadPanelProps) {
  const [name, setName] = useState('');
  const [sheetReference, setSheetReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [pdfPages, setPdfPages] = useState<PdfPagePreview[]>([]);
  const [selectedPdfPage, setSelectedPdfPage] = useState<number | null>(null);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);

  const selectedFilename = useMemo(() => file?.name ?? 'No plan source selected', [file]);
  const selectedFileIsPdf = file?.type === PLAN_PDF_TYPE;
  const selectedPdfPagePreview =
    selectedPdfPage === null
      ? null
      : (pdfPages.find((page) => page.pageNumber === selectedPdfPage) ?? null);
  const canSubmit =
    file !== null &&
    fileError.length === 0 &&
    !creating &&
    !isPreparingPdf &&
    (!selectedFileIsPdf || selectedPdfPage !== null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    const form = event.currentTarget;

    if (file.type === PLAN_PDF_TYPE) {
      if (!selectedPdfPagePreview) return;
      setIsPreparingPdf(true);
      try {
        const renderedPage = await renderPdfPageAsPngFile({
          file,
          pageNumber: selectedPdfPagePreview.pageNumber,
          filename: `${name.trim() || file.name.replace(/\.[^.]+$/, '')}-page-${String(
            selectedPdfPagePreview.pageNumber,
          ).padStart(3, '0')}.png`,
          scale: PDF_RENDER_SCALE,
        });

        await onCreatePlan({
          name: name.trim(),
          sheetReference: sheetReference.trim(),
          file: renderedPage.file,
          sourcePdfFile: file,
          pdfPageNumber: renderedPage.pageNumber,
          pdfPageWidthPt: renderedPage.pageWidthPt,
          pdfPageHeightPt: renderedPage.pageHeightPt,
          pdfRenderScale: renderedPage.renderScale,
          pdfRenderedWidthPx: renderedPage.renderedWidthPx,
          pdfRenderedHeightPx: renderedPage.renderedHeightPx,
          pdfRotation: renderedPage.rotation,
        });
      } catch (err) {
        setFileError(
          err instanceof Error ? err.message : 'Could not render the selected PDF page.',
        );
        return;
      } finally {
        setIsPreparingPdf(false);
      }
    } else {
      await onCreatePlan({
        name: name.trim(),
        sheetReference: sheetReference.trim(),
        file,
      });
    }

    setName('');
    setSheetReference('');
    setFile(null);
    setFileError('');
    setPdfPages([]);
    setSelectedPdfPage(null);
    form.reset();
  }

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setFileError('');
    setPdfPages([]);
    setSelectedPdfPage(null);
    if (!nextFile) return;

    if (name.trim().length === 0) {
      const baseName = nextFile.name
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim();
      setName(baseName.length > 0 ? baseName : nextFile.name);
    }

    if (nextFile.type === PLAN_PDF_TYPE) {
      if (nextFile.size <= 0 || nextFile.size > MAX_PDF_BYTES) {
        setFileError('PDF files must be between 1 byte and 50 MB.');
        return;
      }
      setIsPreparingPdf(true);
      try {
        const pages = await renderPdfThumbnails(nextFile);
        setPdfPages(pages);
        setSelectedPdfPage(pages[0]?.pageNumber ?? null);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : 'Could not read this PDF.');
      } finally {
        setIsPreparingPdf(false);
      }
      return;
    }

    if (!PLAN_IMAGE_TYPES.has(nextFile.type)) {
      setFileError('Upload a PNG, JPEG, WebP, GIF, or PDF file.');
      return;
    }
    if (nextFile.size <= 0 || nextFile.size > MAX_IMAGE_BYTES) {
      setFileError('Image files must be between 1 byte and 10 MB.');
    }
  }

  return (
    <aside className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">Upload</p>
      <h3 className="mt-2 font-display text-xl font-semibold text-neutral-900">
        Add a Measured Plan
      </h3>
      <p className="mt-2 text-sm leading-6 text-neutral-500">
        Upload an image directly, or choose a PDF page to render as a measurable plan sheet.
        Calibration, measurement, and crop tools stay page-specific.
      </p>

      <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-neutral-700">Plan name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="Level 1 Furniture Plan"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-neutral-700">Sheet reference</span>
          <input
            value={sheetReference}
            onChange={(event) => setSheetReference(event.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="A1.1"
          />
        </label>

        <div className="block">
          <label
            htmlFor="measured-plan-source"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Plan source
          </label>
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
            <input
              id="measured-plan-source"
              required
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            <p className="mt-3 text-xs text-neutral-500">{selectedFilename}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Images up to 10 MB, or PDFs up to 50 MB. PDF uploads create a Measured Plan from the
              page you select below.
            </p>
            {fileError ? <p className="mt-2 text-xs text-red-600">{fileError}</p> : null}
          </div>
        </div>

        {selectedFileIsPdf ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                PDF page
              </span>
              {isPreparingPdf ? (
                <span className="text-xs text-neutral-500">Preparing preview...</span>
              ) : (
                <span className="text-xs text-neutral-500">
                  {pdfPages.length} page{pdfPages.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {pdfPages.length > 0 ? (
              <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
                {pdfPages.map((page) => {
                  const active = page.pageNumber === selectedPdfPage;
                  return (
                    <button
                      key={page.pageNumber}
                      type="button"
                      onClick={() => setSelectedPdfPage(page.pageNumber)}
                      className={[
                        'overflow-hidden rounded-lg border bg-white text-left transition',
                        active
                          ? 'border-brand-500 ring-2 ring-brand-100'
                          : 'border-neutral-200 hover:border-brand-200',
                      ].join(' ')}
                    >
                      <img
                        src={page.thumbnailUrl}
                        alt={`PDF page ${page.pageNumber}`}
                        className="aspect-[4/3] w-full object-contain bg-white"
                      />
                      <span className="block px-2 py-1 text-xs font-medium text-neutral-600">
                        Page {page.pageNumber}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {creating || isPreparingPdf ? 'Uploading plan...' : 'Upload plan'}
        </Button>
      </form>
    </aside>
  );
}
