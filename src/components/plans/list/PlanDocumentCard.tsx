import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import type { PlanDocument } from '../../../types';

type PlanDocumentCardProps = {
  document: PlanDocument;
  projectId: string;
  deleting: boolean;
  onDelete: () => void;
};

export function PlanDocumentCard({
  document,
  projectId,
  deleting,
  onDelete,
}: PlanDocumentCardProps) {
  const coverSheet = document.coverSheet;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(coverSheet));

  useEffect(() => {
    let disposed = false;
    let currentObjectUrl: string | null = null;

    async function loadPreview() {
      if (!coverSheet) {
        setPreviewUrl(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const blob = await api.plans.downloadContent(projectId, coverSheet.id);
        if (disposed) return;
        currentObjectUrl = URL.createObjectURL(blob);
        setPreviewUrl(currentObjectUrl);
      } catch {
        if (!disposed) setPreviewUrl(null);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void loadPreview();

    return () => {
      disposed = true;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [coverSheet, projectId]);

  const openHref = `/projects/${projectId}/plans/documents/${document.id}`;
  const sheetLabel = `${document.sheetCount} sheet${document.sheetCount === 1 ? '' : 's'}`;
  const calibratedLabel = `${document.calibratedSheetCount}/${document.sheetCount} calibrated`;
  const measurementLabel = `${document.measurementCount} measurement${document.measurementCount === 1 ? '' : 's'}`;
  const sourceLabel =
    document.sourceType === 'pdf'
      ? `${formatBytes(document.sourceByteSize)} PDF`
      : formatBytes(document.sourceByteSize);

  return (
    <article className="tile-card group relative">
      <div className="relative">
        <Link
          to={openHref}
          aria-label={`Open ${document.name}`}
          className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-canvas-shell">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={document.name}
                className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              />
            ) : (
              <div className="canvas-hatch flex h-full flex-col items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                <FileText className="h-8 w-8 text-brand-700" aria-hidden="true" />
                <span>{loading ? 'Loading cover' : 'Cover unavailable'}</span>
              </div>
            )}

            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-2 bg-brand-700/92 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-md backdrop-blur-sm transition-transform duration-200 ease-out group-hover:translate-y-0 group-focus-within:translate-y-0"
            >
              <span>View sheets</span>
              <span aria-hidden>{'->'}</span>
            </span>
          </div>
        </Link>

        <button
          type="button"
          aria-label="Delete document"
          onClick={onDelete}
          disabled={deleting}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/85 text-neutral-600 opacity-0 shadow-sm backdrop-blur transition hover:border-danger-500 hover:bg-white hover:text-danger-500 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 group-hover:opacity-100 disabled:cursor-progress disabled:opacity-100"
        >
          {deleting ? <SpinnerGlyph /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="num text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
              {sheetLabel}
            </span>
            <span aria-hidden className="text-neutral-300">
              ·
            </span>
            <span className="num-muted text-[11px]">{sourceLabel}</span>
          </div>
          <h3 className="truncate font-display text-base font-semibold text-neutral-950">
            {document.name}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={[
              'status-chip',
              document.sheetCount > 0 && document.calibratedSheetCount === document.sheetCount
                ? 'status-chip--ok'
                : 'status-chip--warn',
            ].join(' ')}
          >
            {calibratedLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 border border-neutral-200 bg-canvas-shell px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-700">
            <span className="num text-neutral-950">{document.measurementCount}</span>
            <span className="text-neutral-500">
              {document.measurementCount === 1 ? 'measurement' : 'measurements'}
            </span>
          </span>
          <span className="sr-only">{measurementLabel}</span>
        </div>

        <p className="border-t border-neutral-200 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Updated{' '}
          <span className="num normal-case tracking-normal text-neutral-700">
            {formatDate(document.updatedAt)}
          </span>
        </p>
      </div>
    </article>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SpinnerGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="animate-spin">
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.25"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
