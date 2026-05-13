import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { MeasuredPlan } from '../../../types';
import { Button } from '../../primitives';

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

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="aspect-[4/3] bg-neutral-100">
        {previewUrl ? (
          <img src={previewUrl} alt={plan.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            {loading ? <>Loading preview&hellip;</> : 'Preview unavailable'}
          </div>
        )}
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-neutral-900">{plan.name}</h3>
              <p className="text-sm text-neutral-500">
                {plan.sheetReference || 'No sheet reference'}
              </p>
            </div>
            <span
              className={[
                'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                plan.calibrationStatus === 'calibrated'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700',
              ].join(' ')}
            >
              {plan.calibrationStatus}
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            {plan.sourceType === 'pdf-page' && plan.pdfPageNumber
              ? `PDF page ${plan.pdfPageNumber}`
              : formatBytes(plan.imageByteSize)}
            {' · '}
            {plan.measurementCount} measurement
            {plan.measurementCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
          <div className="text-xs text-neutral-400">
            Added {new Date(plan.createdAt).toLocaleDateString('en-US')}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/projects/${projectId}/plans/${plan.id}`}
              className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              Open
            </Link>
            <Button type="button" variant="ghost" size="sm" onClick={onDelete} disabled={deleting}>
              {deleting ? <>Deleting&hellip;</> : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
