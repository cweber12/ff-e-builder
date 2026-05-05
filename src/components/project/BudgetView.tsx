import { Link, useParams } from 'react-router-dom';
import {
  projectTotalCents,
  roomSubtotalCents,
  proposalCategorySubtotalCents,
  proposalProjectTotalCents,
} from '../../lib/calc';
import {
  cents,
  formatMoney,
  itemStatuses,
  type ItemStatus,
  type Project,
  type RoomWithItems,
  type ProposalCategoryWithItems,
} from '../../types';
import { StatusBadge } from '../primitives/StatusBadge';

type Props = {
  project: Project;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
};

export function BudgetView({ project, roomsWithItems, proposalCategoriesWithItems }: Props) {
  const { id } = useParams();
  const ffeActualCents = projectTotalCents(roomsWithItems);
  const proposalActualCents = proposalProjectTotalCents(proposalCategoriesWithItems);
  const combinedActualCents = ffeActualCents + proposalActualCents;

  const statusCounts = Object.fromEntries(
    itemStatuses.map((s) => [
      s,
      roomsWithItems.reduce((n, r) => n + r.items.filter((i) => i.status === s).length, 0),
    ]),
  ) as Record<ItemStatus, number>;

  const isIndividual = project.budgetMode === 'individual';
  const ffeBudgetCents = isIndividual ? (project.ffeBudgetCents ?? 0) : project.budgetCents;
  const proposalBudgetCents = isIndividual
    ? (project.proposalBudgetCents ?? 0)
    : project.budgetCents;
  const combinedBudgetCents = isIndividual
    ? (project.ffeBudgetCents ?? 0) + (project.proposalBudgetCents ?? 0)
    : project.budgetCents;

  const hasCombinedBudget = combinedBudgetCents > 0;
  const combinedPercent = hasCombinedBudget
    ? Math.min(Math.round((combinedActualCents / combinedBudgetCents) * 100), 100)
    : 0;
  const combinedTone =
    hasCombinedBudget && combinedActualCents > combinedBudgetCents
      ? 'bg-danger-500'
      : combinedPercent >= 80
        ? 'bg-warning-500'
        : 'bg-success-500';

  return (
    <div className="space-y-6">
      {/* Combined total */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Combined budget
            </h2>
            <p className="mt-1 text-2xl font-bold text-gray-950">
              {formatMoney(cents(combinedActualCents))}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              {hasCombinedBudget
                ? `against ${formatMoney(cents(combinedBudgetCents))} budget`
                : 'No budget target set'}
            </p>
          </div>
          {hasCombinedBudget && (
            <span className="text-lg font-semibold tabular-nums text-gray-700">
              {combinedPercent}%
            </span>
          )}
        </div>
        {hasCombinedBudget && (
          <div className="mt-4 h-3 overflow-hidden rounded-pill bg-gray-100">
            <div
              className={`h-full rounded-pill ${combinedTone} transition-all`}
              style={{ width: `${combinedPercent}%` }}
            />
          </div>
        )}
      </section>

      {/* Tool cards */}
      <section className="grid gap-4 md:grid-cols-2">
        <ToolCard
          label="FF&E"
          actualCents={ffeActualCents}
          budgetCents={ffeBudgetCents}
          itemCount={roomsWithItems.reduce((n, r) => n + r.items.length, 0)}
          itemLabel="items"
          linkTo={`/projects/${id}/ffe/table`}
        />
        <ToolCard
          label="Proposal"
          actualCents={proposalActualCents}
          budgetCents={proposalBudgetCents}
          itemCount={proposalCategoriesWithItems.reduce((n, c) => n + c.items.length, 0)}
          itemLabel="line items"
          linkTo={`/projects/${id}/proposal/table`}
        />
      </section>

      {/* Breakdowns */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* FF&E rooms */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              FF&amp;E by room
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Room</th>
                <th className="px-4 py-2 text-right">Items</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roomsWithItems.map((room) => (
                <tr key={room.id}>
                  <td className="px-4 py-2 font-medium text-gray-950">{room.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {room.items.length}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-950">
                    {formatMoney(cents(roomSubtotalCents(room.items)))}
                  </td>
                </tr>
              ))}
              <tr className="bg-brand-50/50">
                <td className="px-4 py-2 font-semibold text-gray-950">Total</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-right font-bold tabular-nums text-brand-700">
                  {formatMoney(cents(ffeActualCents))}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3">
            {itemStatuses.map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <StatusBadge status={s} />
                <span className="text-xs tabular-nums text-gray-500">{statusCounts[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Proposal categories */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Proposal by category
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Rows</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {proposalCategoriesWithItems.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-2 font-medium text-gray-950">{category.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {category.items.length}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {category.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-950">
                    {formatMoney(cents(proposalCategorySubtotalCents(category.items)))}
                  </td>
                </tr>
              ))}
              <tr className="bg-brand-50/50">
                <td className="px-4 py-2 font-semibold text-gray-950">Total</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-right font-bold tabular-nums text-brand-700">
                  {formatMoney(cents(proposalActualCents))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ToolCard({
  label,
  actualCents,
  budgetCents,
  itemCount,
  itemLabel,
  linkTo,
}: {
  label: string;
  actualCents: number;
  budgetCents: number;
  itemCount: number;
  itemLabel: string;
  linkTo: string;
}) {
  const hasBudget = budgetCents > 0;
  const pct = hasBudget ? Math.min(Math.round((actualCents / budgetCents) * 100), 100) : 0;
  const tone =
    hasBudget && actualCents > budgetCents
      ? 'bg-danger-500'
      : pct >= 80
        ? 'bg-warning-500'
        : 'bg-success-500';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
        <Link to={linkTo} className="text-xs font-medium text-brand-600 hover:text-brand-700">
          View →
        </Link>
      </div>
      <p className="mt-2 text-xl font-bold text-gray-950">{formatMoney(cents(actualCents))}</p>
      <p className="mt-0.5 text-xs text-gray-500">
        {itemCount} {itemLabel}
        {hasBudget && ` · ${pct}% of ${formatMoney(cents(budgetCents))}`}
      </p>
      {hasBudget && (
        <div className="mt-3 h-2 overflow-hidden rounded-pill bg-gray-100">
          <div
            className={`h-full rounded-pill ${tone} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
