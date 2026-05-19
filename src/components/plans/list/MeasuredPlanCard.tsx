import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { MeasuredPlan } from '../../../types';

type MeasuredPlanCardProps = {
  plan: MeasuredPlan;
  projectId: string;
  deleting: boolean;
  onDelete: () => void;
};

export function MeasuredPlanCard({ plan, projectId, deleting, onDelete }: MeasuredPlanCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let currentObjectUrl: string | null = null;

    async function loadPreview() {
      setLoading(true);
      try {
        const blob = await api.plans.downloadContent(projectId, plan.id);
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
  }, [plan.id, projectId]);

  const calibrated = plan.calibrationStatus === 'calibrated';
  const measurementLabel = `${plan.measurementCount} measurement${plan.measurementCount === 1 ? '' : 's'}`;
  const sourceLabel =
    plan.sourceType === 'pdf-page' && plan.pdfPageNumber
      ? `PDF · p.${String(plan.pdfPageNumber).padStart(2, '0')}`
      : formatBytes(plan.imageByteSize);
  const openHref = `/projects/${projectId}/plans/${plan.id}`;

  return (
    <article className="tile-card group relative">
      <div className="relative">
        <Link
          to={openHref}
          aria-label={`Open ${plan.name}`}
          className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={plan.name}
                className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              />
            ) : (
              <div className="canvas-hatch flex h-full items-center justify-center text-xs font-medium text-neutral-400">
                {loading ? 'Loading preview…' : 'Preview unavailable'}
              </div>
            )}

            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-2 bg-brand-700/92 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-md backdrop-blur-sm transition-transform duration-200 ease-out group-hover:translate-y-0 group-focus-within:translate-y-0"
            >
              <span>View plan</span>
              <span aria-hidden>→</span>
            </span>
          </div>
        </Link>

        <button
          type="button"
          aria-label="Delete"
          onClick={onDelete}
          disabled={deleting}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/85 text-neutral-600 opacity-0 shadow-sm backdrop-blur transition hover:border-danger-500 hover:bg-white hover:text-danger-500 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 group-hover:opacity-100 disabled:cursor-progress disabled:opacity-100"
        >
          {deleting ? <SpinnerGlyph /> : <TrashGlyph />}
        </button>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span
              className={[
                'num text-[11px] font-semibold uppercase tracking-[0.12em]',
                plan.sheetReference ? 'text-brand-700' : 'text-neutral-400',
              ].join(' ')}
            >
              {plan.sheetReference || 'No ref'}
            </span>
            <span aria-hidden className="text-neutral-300">
              ·
            </span>
            <span className="num-muted text-[11px]">{sourceLabel}</span>
          </div>
          <h3 className="truncate font-display text-base font-semibold text-neutral-950">
            {plan.name}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={['status-chip', calibrated ? 'status-chip--ok' : 'status-chip--warn'].join(
              ' ',
            )}
          >
            {calibrated ? 'Calibrated' : 'Needs calibration'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
            <span className="num">{plan.measurementCount}</span>
            <span>{plan.measurementCount === 1 ? 'measurement' : 'measurements'}</span>
          </span>
          <span className="sr-only">{measurementLabel}</span>
        </div>

        <p className="border-t border-neutral-200/70 pt-3 text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          Added{' '}
          <span className="num normal-case tracking-normal text-neutral-500">
            {formatDate(plan.createdAt)}
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

function TrashGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5" strokeLinecap="round" />
      <path d="M4.5 4.5h7l-.6 8a1 1 0 0 1-1 .9H6.1a1 1 0 0 1-1-.9z" />
      <path d="M6.8 7.2v3.6M9.2 7.2v3.6" strokeLinecap="round" />
    </svg>
  );
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
