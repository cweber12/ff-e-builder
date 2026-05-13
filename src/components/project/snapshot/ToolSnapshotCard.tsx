import { Link } from 'react-router-dom';
import { cents, formatMoney, itemStatuses, type ItemStatus } from '../../../types';
import type { SnapshotToolSummary } from '../../../lib/projectSnapshot';

const STATUS_COLORS: Record<ItemStatus, string> = {
  pending: 'bg-warning-500',
  ordered: 'bg-brand-400',
  approved: 'bg-success-500',
  received: 'bg-neutral-300',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: 'Pending',
  ordered: 'Ordered',
  approved: 'Approved',
  received: 'Received',
};

export function ToolSnapshotCard({
  title,
  summary,
  to,
  count,
  countLabel,
  description,
  metrics,
  statusBreakdown,
}: {
  title: string;
  summary: SnapshotToolSummary;
  to: string;
  count: number;
  countLabel: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
  statusBreakdown?: Record<ItemStatus, number>;
}) {
  const statusTotal = statusBreakdown
    ? itemStatuses.reduce((sum, s) => sum + (statusBreakdown[s] ?? 0), 0)
    : 0;
  const ctaLabel = title.replace(' Snapshot', '');

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">{title}</p>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="font-display text-4xl font-semibold text-neutral-900">{count}</p>
        <span className="text-sm text-neutral-400">{countLabel}</span>
      </div>
      <p className="mt-1 text-sm text-neutral-400">{description}</p>

      {statusBreakdown && statusTotal > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100">
            {itemStatuses
              .filter((s) => (statusBreakdown[s] ?? 0) > 0)
              .map((s) => (
                <div
                  key={s}
                  className={`h-full ${STATUS_COLORS[s]}`}
                  style={{ width: `${((statusBreakdown[s] ?? 0) / statusTotal) * 100}%` }}
                />
              ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {itemStatuses
              .filter((s) => (statusBreakdown[s] ?? 0) > 0)
              .map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[s]}`} />
                  <span className="text-xs text-neutral-500">
                    {STATUS_LABELS[s]}{' '}
                    <span className="font-semibold text-neutral-700">{statusBreakdown[s]}</span>
                  </span>
                </div>
              ))}
          </div>
          <p className="text-xs text-neutral-400">
            Total{' '}
            <span className="font-semibold text-neutral-700">
              {formatMoney(cents(summary.totalCents))}
            </span>
          </p>
        </div>
      ) : (
        <dl className="mt-4 space-y-1.5">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-neutral-400">{m.label}</dt>
              <dd className="text-sm font-semibold text-neutral-700">{m.value}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-neutral-400">Total</dt>
            <dd className="text-sm font-semibold text-neutral-700">
              {formatMoney(cents(summary.totalCents))}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-5">
        <Link
          to={to}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 transition-colors hover:text-brand-700"
        >
          Open {ctaLabel}
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
