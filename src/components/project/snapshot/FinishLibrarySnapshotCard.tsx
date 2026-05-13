import { Link } from 'react-router-dom';
import type { SnapshotMaterialsSummary } from '../../../lib/projectSnapshot';

export function FinishLibrarySnapshotCard({
  projectId,
  summary,
  isLoading,
}: {
  projectId: string;
  summary: SnapshotMaterialsSummary;
  isLoading: boolean;
}) {
  const referencedCount = summary.totalMaterials - summary.unusedCount;
  const referencedPct =
    summary.totalMaterials > 0 ? Math.round((referencedCount / summary.totalMaterials) * 100) : 0;
  const unusedPct = 100 - referencedPct;

  return (
    <section className="py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Finish Library
      </p>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="font-display text-4xl font-semibold text-neutral-900">
          {isLoading ? '—' : summary.totalMaterials}
        </p>
        <span className="text-sm text-neutral-400">finishes</span>
      </div>
      <p className="mt-1 text-sm text-neutral-400">
        {isLoading
          ? 'Loading library...'
          : summary.totalMaterials > 0
            ? `${referencedPct}% referenced across project`
            : 'No finishes in library yet'}
      </p>

      {!isLoading && summary.totalMaterials > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100">
            {referencedPct > 0 && (
              <div
                className={`h-full bg-brand-400 ${unusedPct === 0 ? 'rounded-full' : 'rounded-l-full'}`}
                style={{ width: `${referencedPct}%` }}
              />
            )}
            {unusedPct > 0 && (
              <div
                className={`h-full bg-neutral-200 ${referencedPct === 0 ? 'rounded-full' : 'rounded-r-full'}`}
                style={{ width: `${unusedPct}%` }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-brand-400" />
              FF&amp;E{' '}
              <span className="font-semibold text-neutral-700">{summary.usedInFfeCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-brand-300" />
              Proposal{' '}
              <span className="font-semibold text-neutral-700">{summary.usedInProposalCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-neutral-200" />
              Unused <span className="font-semibold text-neutral-700">{summary.unusedCount}</span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-5">
        <Link
          to={`/projects/${projectId}/materials`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 transition-colors hover:text-brand-700"
        >
          Open Finish Library
          <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
