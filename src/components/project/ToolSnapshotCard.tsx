import { Link } from 'react-router-dom';
import { cents, formatMoney } from '../../types';
import type { SnapshotToolSummary } from '../../lib/projectSnapshot';

export function ToolSnapshotCard({
  title,
  summary,
  to,
  count,
  countLabel,
  description,
  metrics,
}: {
  title: string;
  summary: SnapshotToolSummary;
  to: string;
  count: number;
  countLabel: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
}) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
          <h3 className="mt-1 text-xl font-semibold text-gray-950">{count}</h3>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-sm font-semibold text-gray-700">
          {countLabel}
        </span>
      </div>

      <dl className="mt-4 grid gap-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-surface-muted px-3 py-2.5"
          >
            <dt className="text-sm text-gray-700">{metric.label}</dt>
            <dd className="text-sm font-semibold text-gray-950">{metric.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-surface-muted px-3 py-2.5">
          <dt className="text-sm text-gray-700">Total</dt>
          <dd className="text-sm font-semibold text-gray-950">
            {formatMoney(cents(summary.totalCents))}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
