import React, { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { CreateMeasuredPlanInput } from '../../../lib/api';
import {
  renderPdfPageAsPngFile,
  renderPdfThumbnails,
  type PdfPagePreview,
} from '../../../lib/plans/pdf';
import { Button, Modal } from '../../primitives';

type PlanUploadModalProps = {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreatePlan: (input: CreateMeasuredPlanInput) => Promise<unknown>;
};

const PLAN_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const PLAN_PDF_TYPE = 'application/pdf';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const PDF_RENDER_SCALE = 2;

type Step = 1 | 2 | 3;
type PdfPageDetails = Record<number, { name: string; sheetReference: string }>;

export function PlanUploadModal({ open, creating, onClose, onCreatePlan }: PlanUploadModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [sheetReference, setSheetReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [pdfPages, setPdfPages] = useState<PdfPagePreview[]>([]);
  const [selectedPdfPages, setSelectedPdfPages] = useState<number[]>([]);
  const [pdfPageDetails, setPdfPageDetails] = useState<PdfPageDetails>({});
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFileIsPdf = file?.type === PLAN_PDF_TYPE;
  const selectedPdfPagePreviews = pdfPages.filter((page) =>
    selectedPdfPages.includes(page.pageNumber),
  );

  const totalSteps = selectedFileIsPdf ? 3 : 2;
  const visibleStep = selectedFileIsPdf ? step : step === 3 ? 2 : step;

  useEffect(() => {
    if (!open) {
      setStep(1);
      setName('');
      setSheetReference('');
      setFile(null);
      setFileError('');
      setPdfPages([]);
      setSelectedPdfPages([]);
      setPdfPageDetails({});
      setIsPreparingPdf(false);
      setIsDragging(false);
      setUploadProgress(null);
    }
  }, [open]);

  const canAdvanceFromSource =
    file !== null &&
    fileError.length === 0 &&
    !isPreparingPdf &&
    (!selectedFileIsPdf || pdfPages.length > 0);
  const canAdvanceFromPage = !selectedFileIsPdf || selectedPdfPages.length > 0;
  const canSubmit =
    file !== null &&
    (step === 3 || fileError.length === 0) &&
    !creating &&
    !isPreparingPdf &&
    uploadProgress === null &&
    (selectedFileIsPdf
      ? selectedPdfPagePreviews.length > 0 &&
        selectedPdfPagePreviews.every(
          (page) => (pdfPageDetails[page.pageNumber]?.name ?? '').trim().length > 0,
        )
      : name.trim().length > 0);

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setFileError('');
    setPdfPages([]);
    setSelectedPdfPages([]);
    setPdfPageDetails({});
    setUploadProgress(null);
    if (!nextFile) return;

    const baseName = nextFile.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
    if (name.trim().length === 0) {
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
        setSelectedPdfPages(pages.map((page) => page.pageNumber));
        setPdfPageDetails(
          Object.fromEntries(
            pages.map((page) => [
              page.pageNumber,
              {
                name: `${baseName.length > 0 ? baseName : nextFile.name} page ${String(
                  page.pageNumber,
                ).padStart(2, '0')}`,
                sheetReference: '',
              },
            ]),
          ),
        );
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

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (dropped) void handleFileChange(dropped);
  }

  function handleNext() {
    if (step === 1 && canAdvanceFromSource) {
      setStep(selectedFileIsPdf ? 2 : 3);
      return;
    }
    if (step === 2 && canAdvanceFromPage) {
      setStep(3);
    }
  }

  function handleBack() {
    if (step === 3) {
      setStep(selectedFileIsPdf ? 2 : 1);
      return;
    }
    if (step === 2) setStep(1);
  }

  async function handleSubmit() {
    if (!canSubmit || !file) return;
    setFileError('');

    if (selectedFileIsPdf) {
      const pagesToUpload = selectedPdfPagePreviews.sort((a, b) => a.pageNumber - b.pageNumber);
      if (pagesToUpload.length === 0) return;

      let completedUploads = 0;
      setIsPreparingPdf(true);
      setUploadProgress({ current: 0, total: pagesToUpload.length });
      try {
        for (const [index, page] of pagesToUpload.entries()) {
          const details = pdfPageDetails[page.pageNumber] ?? {
            name: '',
            sheetReference: '',
          };
          const trimmedName = details.name.trim();
          const renderedPage = await renderPdfPageAsPngFile({
            file,
            pageNumber: page.pageNumber,
            filename: `${trimmedName || file.name.replace(/\.[^.]+$/, '')}-page-${String(
              page.pageNumber,
            ).padStart(3, '0')}.png`,
            scale: PDF_RENDER_SCALE,
          });

          await onCreatePlan({
            name: trimmedName,
            sheetReference: details.sheetReference.trim(),
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
          completedUploads = index + 1;
          setUploadProgress({ current: index + 1, total: pagesToUpload.length });
        }
        onClose();
      } catch (err) {
        const remaining = pagesToUpload.length - completedUploads;
        setFileError(
          err instanceof Error
            ? `${err.message} ${completedUploads} page${
                completedUploads === 1 ? '' : 's'
              } uploaded; ${remaining} remaining.`
            : `${completedUploads} page${
                completedUploads === 1 ? '' : 's'
              } uploaded; ${remaining} remaining.`,
        );
        return;
      } finally {
        setIsPreparingPdf(false);
        setUploadProgress(null);
      }
    } else {
      await onCreatePlan({
        name: name.trim(),
        sheetReference: sheetReference.trim(),
        file,
      });
      onClose();
    }
  }

  const submitLabel =
    creating || isPreparingPdf
      ? uploadProgress
        ? `Uploading ${uploadProgress.current + 1}/${uploadProgress.total}…`
        : 'Uploading plan…'
      : selectedFileIsPdf
        ? `Upload ${selectedPdfPages.length} page${selectedPdfPages.length === 1 ? '' : 's'}`
        : 'Upload plan';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload measured plan"
      className="max-w-3xl w-[min(100%,52rem)]"
    >
      <div className="-mx-6 -my-4">
        <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-3">
          <StepRibbon currentStep={visibleStep} totalSteps={totalSteps} isPdf={selectedFileIsPdf} />
        </div>

        <div className="min-h-[24rem] px-6 py-5">
          {step === 1 ? (
            <StepSource
              file={file}
              fileError={fileError}
              isPreparingPdf={isPreparingPdf}
              isDragging={isDragging}
              onPick={() => fileInputRef.current?.click()}
              onClear={() => void handleFileChange(null)}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              fileInputRef={fileInputRef}
              onFileInputChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
            />
          ) : null}

          {step === 2 ? (
            <StepPage
              pages={pdfPages}
              selectedPdfPages={selectedPdfPages}
              isPreparingPdf={isPreparingPdf}
              onToggle={(pageNumber) => {
                setSelectedPdfPages((current) =>
                  current.includes(pageNumber)
                    ? current.filter((candidate) => candidate !== pageNumber)
                    : [...current, pageNumber].sort((a, b) => a - b),
                );
              }}
              onSelectAll={() => setSelectedPdfPages(pdfPages.map((page) => page.pageNumber))}
              onClearSelection={() => setSelectedPdfPages([])}
            />
          ) : null}

          {step === 3 ? (
            <StepDetails
              file={file}
              name={name}
              sheetReference={sheetReference}
              onNameChange={setName}
              onSheetReferenceChange={setSheetReference}
              selectedPdfPages={selectedPdfPagePreviews}
              pdfPageDetails={pdfPageDetails}
              onPdfPageDetailsChange={(pageNumber, details) => {
                setPdfPageDetails((current) => ({
                  ...current,
                  [pageNumber]: {
                    ...(current[pageNumber] ?? { name: '', sheetReference: '' }),
                    ...details,
                  },
                }));
              }}
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/70 px-6 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={step === 1 ? onClose : handleBack}
            disabled={creating || isPreparingPdf}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step === 3 ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {submitLabel}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleNext}
              disabled={step === 1 ? !canAdvanceFromSource : !canAdvanceFromPage}
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function StepRibbon({
  currentStep,
  totalSteps,
  isPdf,
}: {
  currentStep: number;
  totalSteps: number;
  isPdf: boolean;
}) {
  const labels = isPdf
    ? ['Choose source', 'Pick pages', 'Name & ref']
    : ['Choose source', 'Name & ref'];

  return (
    <ol className="flex items-center gap-3" aria-label="Upload steps">
      {labels.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isComplete = stepNumber < currentStep;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={[
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition',
                isActive
                  ? 'bg-brand-600 text-white shadow-sm'
                  : isComplete
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-neutral-200 text-neutral-500',
              ].join(' ')}
              aria-current={isActive ? 'step' : undefined}
            >
              {isComplete ? '✓' : stepNumber}
            </span>
            <span
              className={[
                'text-[11px] font-semibold uppercase tracking-[0.12em]',
                isActive ? 'text-neutral-900' : 'text-neutral-500',
              ].join(' ')}
            >
              {label}
            </span>
            {stepNumber < totalSteps ? (
              <span aria-hidden className="h-px w-8 bg-neutral-300" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

type StepSourceProps = {
  file: File | null;
  fileError: string;
  isPreparingPdf: boolean;
  isDragging: boolean;
  onPick: () => void;
  onClear: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function StepSource({
  file,
  fileError,
  isPreparingPdf,
  isDragging,
  onPick,
  onClear,
  onDragEnter,
  onDragLeave,
  onDrop,
  fileInputRef,
  onFileInputChange,
}: StepSourceProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-neutral-500">
        Drag an architectural sheet onto this panel, or click to browse. Images become measured
        plans directly. PDFs continue to the page picker.
      </p>

      <div
        onClick={file ? undefined : onPick}
        onKeyDown={(event) => {
          if (file) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onPick();
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragEnter();
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role={file ? undefined : 'button'}
        tabIndex={file ? -1 : 0}
        aria-label={file ? undefined : 'Choose plan file'}
        className={[
          'group flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
          file
            ? 'border-neutral-200 bg-white'
            : isDragging
              ? 'border-brand-500 bg-brand-50 cursor-pointer'
              : 'border-neutral-300 bg-neutral-50 hover:border-brand-300 hover:bg-brand-50/40 cursor-pointer focus-ring',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          aria-label="Plan source"
          id="plan-upload-source"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          onChange={onFileInputChange}
          className="sr-only"
        />

        {file ? (
          <div className="flex items-center gap-4">
            <FileGlyph kind={file.type === 'application/pdf' ? 'pdf' : 'image'} />
            <div className="text-left">
              <p className="font-display text-base font-semibold text-neutral-900">{file.name}</p>
              <p className="num-muted mt-1 text-xs">
                {formatBytes(file.size)} · {file.type || 'unknown type'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
            >
              Replace
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <UploadGlyph />
            <div>
              <p className="font-display text-base font-semibold text-neutral-900">
                Drop a plan here
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                or click to choose · PNG, JPEG, WebP, GIF up to 10&nbsp;MB · PDF up to 50&nbsp;MB
              </p>
            </div>
          </div>
        )}
      </div>

      {isPreparingPdf ? (
        <p className="text-xs font-medium text-neutral-500">Preparing PDF preview…</p>
      ) : null}
      {fileError ? (
        <p className="rounded-md bg-warning-50 px-3 py-2 text-xs font-medium text-warning-700">
          {fileError}
        </p>
      ) : null}
    </div>
  );
}

function StepPage({
  pages,
  selectedPdfPages,
  isPreparingPdf,
  onToggle,
  onSelectAll,
  onClearSelection,
}: {
  pages: PdfPagePreview[];
  selectedPdfPages: number[];
  isPreparingPdf: boolean;
  onToggle: (pageNumber: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm leading-6 text-neutral-500">
          Select the PDF pages to import. Each selected page becomes its own measured plan.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            {isPreparingPdf ? 'Loading…' : `${selectedPdfPages.length}/${pages.length} selected`}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onSelectAll}>
            All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
            None
          </Button>
        </div>
      </div>

      {pages.length > 0 ? (
        <div
          className="grid max-h-[26rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4"
          role="group"
          aria-label="PDF pages"
        >
          {pages.map((page) => {
            const active = selectedPdfPages.includes(page.pageNumber);
            return (
              <button
                key={page.pageNumber}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(page.pageNumber)}
                className={[
                  'group relative overflow-hidden rounded-xl border bg-white text-left transition focus-ring',
                  active
                    ? 'border-brand-500 ring-2 ring-brand-200'
                    : 'border-neutral-200 hover:border-brand-300',
                ].join(' ')}
              >
                <img
                  src={page.thumbnailUrl}
                  alt={`PDF page ${page.pageNumber}`}
                  className="aspect-[4/3] w-full bg-white object-contain"
                />
                <div className="flex items-center justify-between border-t border-neutral-100 px-2.5 py-1.5">
                  <span className="num text-[11px] font-semibold text-neutral-700">
                    {String(page.pageNumber).padStart(2, '0')}
                  </span>
                  {active ? (
                    <span className="status-chip status-chip--ok text-[10px]">Selected</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500">
          {isPreparingPdf ? 'Rendering page previews…' : 'No pages found in this PDF.'}
        </div>
      )}
    </div>
  );
}

function StepDetails({
  file,
  name,
  sheetReference,
  onNameChange,
  onSheetReferenceChange,
  selectedPdfPages,
  pdfPageDetails,
  onPdfPageDetailsChange,
}: {
  file: File | null;
  name: string;
  sheetReference: string;
  onNameChange: (value: string) => void;
  onSheetReferenceChange: (value: string) => void;
  selectedPdfPages: PdfPagePreview[];
  pdfPageDetails: PdfPageDetails;
  onPdfPageDetailsChange: (
    pageNumber: number,
    details: Partial<{ name: string; sheetReference: string }>,
  ) => void;
}) {
  const isPdf = file?.type === PLAN_PDF_TYPE;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <FileGlyph kind={file?.type === 'application/pdf' ? 'pdf' : 'image'} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-neutral-900">
            {file?.name ?? 'No source selected'}
          </p>
          <p className="num-muted mt-0.5 text-xs">
            {file ? formatBytes(file.size) : '-'}
            {isPdf
              ? ` · ${selectedPdfPages.length} selected page${
                  selectedPdfPages.length === 1 ? '' : 's'
                }`
              : ''}
          </p>
        </div>
      </div>

      {isPdf ? (
        <div className="max-h-[21rem] overflow-y-auto rounded-xl border border-neutral-200">
          <div className="grid grid-cols-[72px_minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
            <span>Page</span>
            <span>Sheet ref</span>
            <span>Page name</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {selectedPdfPages.map((page) => {
              const details = pdfPageDetails[page.pageNumber] ?? {
                name: '',
                sheetReference: '',
              };

              return (
                <div
                  key={page.pageNumber}
                  className="grid grid-cols-[72px_minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 px-3 py-2.5"
                >
                  <span className="num flex items-center text-xs font-semibold text-neutral-500">
                    {String(page.pageNumber).padStart(2, '0')}
                  </span>
                  <input
                    value={details.sheetReference}
                    onChange={(event) =>
                      onPdfPageDetailsChange(page.pageNumber, {
                        sheetReference: event.target.value,
                      })
                    }
                    placeholder="A1-1"
                    className="input-base num !py-1.5 text-sm"
                    aria-label={`Sheet reference for page ${page.pageNumber}`}
                  />
                  <input
                    required
                    value={details.name}
                    onChange={(event) =>
                      onPdfPageDetailsChange(page.pageNumber, { name: event.target.value })
                    }
                    placeholder="Level 1 Furniture Plan"
                    className="input-base !py-1.5 text-sm"
                    aria-label={`Page name for page ${page.pageNumber}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
              Plan name
            </span>
            <input
              required
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Level 1 Furniture Plan"
              className="input-base"
              aria-label="Plan name"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
              Sheet reference
            </span>
            <input
              value={sheetReference}
              onChange={(event) => onSheetReferenceChange(event.target.value)}
              placeholder="A1.1"
              className="input-base num"
              aria-label="Sheet reference"
            />
            <span className="mt-1 block text-[11px] text-neutral-400">Optional · e.g. A1.1</span>
          </label>
        </div>
      )}
    </div>
  );
}

function FileGlyph({ kind }: { kind: 'pdf' | 'image' }) {
  return (
    <span
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5"
      >
        {kind === 'pdf' ? (
          <>
            <path d="M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <path d="M15 3v4h4" />
            <path d="M9 13h2M9 16h6M9 19h6" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="m5 18 5-5 4 4 2-2 3 3" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </span>
  );
}

function UploadGlyph() {
  return (
    <span
      className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-7 w-7"
      >
        <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
