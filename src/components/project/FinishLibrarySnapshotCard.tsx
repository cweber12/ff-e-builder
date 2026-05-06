import { Link } from 'react-router-dom';
import type { SnapshotMaterialsSummary } from '../../lib/projectSnapshot';

export function FinishLibrarySnapshotCard({
  projectId,
  summary,
  isLoading,
}: {
  projectId: string;
  summary: SnapshotMaterialsSummary;
  isLoading: boolean;
}) {
  return (
    <Link
      to={`/projects/${projectId}/materials`}
      className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Finish Library</p>
      <h3 className="mt-1 text-xl font-semibold text-gray-950">
        {isLoading ? '...' : summary.totalMaterials}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        {isLoading ? 'Loading library usage...' : 'Reusable project finishes'}
      </p>

      <div className="mt-4 grid gap-2">
        <UsageRow label="Used in FF&E" value={isLoading ? '...' : String(summary.usedInFfeCount)} />
        <UsageRow
          label="Used in Proposal"
          value={isLoading ? '...' : String(summary.usedInProposalCount)}
        />
        <UsageRow label="Unused" value={isLoading ? '...' : String(summary.unusedCount)} />
      </div>
    </Link>
  );
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-surface-muted px-3 py-2.5">
      <p className="text-sm text-gray-700">{label}</p>
      <p className="text-sm font-semibold text-gray-950">{value}</p>
    </div>
  );
}
