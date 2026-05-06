import { Link } from 'react-router-dom';
import {
  cents,
  formatMoney,
  type Project,
  type ProposalCategoryWithItems,
  type RoomWithItems,
} from '../../types';
import { buildBudgetSummary } from '../../lib/projectSnapshot';

export function BudgetSnapshotCard({
  project,
  roomsWithItems,
  proposalCategoriesWithItems,
}: {
  project: Project;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
}) {
  const summary = buildBudgetSummary(project, roomsWithItems, proposalCategoriesWithItems);

  return (
    <Link
      to={`/projects/${project.id}/budget`}
      className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Budget</p>
      <h3 className="mt-1 text-xl font-semibold text-gray-950">
        {formatMoney(cents(summary.combinedActualCents))}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        {summary.combinedBudgetCents > 0
          ? `Combined target ${formatMoney(cents(summary.combinedBudgetCents))}`
          : 'No combined budget target set'}
      </p>

      <dl className="mt-4 grid gap-2">
        <MetricRow
          label="Budget Mode"
          value={project.budgetMode === 'individual' ? 'Split budgets' : 'Shared budget'}
        />
        <MetricRow label="FF&E Total" value={formatMoney(cents(summary.ffeActualCents))} />
        <MetricRow label="Proposal Total" value={formatMoney(cents(summary.proposalActualCents))} />
      </dl>
    </Link>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-surface-muted px-3 py-2.5">
      <dt className="text-sm text-gray-700">{label}</dt>
      <dd className="text-sm font-semibold text-gray-950">{value}</dd>
    </div>
  );
}
