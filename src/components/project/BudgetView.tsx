import { Link, useParams } from 'react-router-dom';
import {
  projectTotalCents,
  roomSubtotalCents,
  proposalCategorySubtotalCents,
  proposalProjectTotalCents,
} from '../../lib/money';
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
    <div className="space-y-10">
      {/* Combined total */}
      <section>
        <p className="eyebrow">Combined Budget</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-4">
          <div>
            <h2 className="num font-display text-3xl font-semibold tracking-tight text-neutral-950">
              {formatMoney(cents(combinedActualCents))}
              {hasCombinedBudget && (
                <span className="ml-2 text-base font-medium text-neutral-500">
                  of {formatMoney(cents(combinedBudgetCents))}
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {!hasCombinedBudget
                ? 'No budget target set'
                : combinedActualCents > combinedBudgetCents
                  ? 'Over budget'
                  : 'Within budget'}
            </p>
          </div>
          {hasCombinedBudget && (
            <span className="num text-3xl font-semibold tracking-tight text-neutral-950">
              {combinedPercent}%
            </span>
          )}
        </div>
        {hasCombinedBudget && (
          <div className="mt-4 h-1.5 overflow-hidden bg-canvas-shell">
            <div
              className={`h-full ${combinedTone} transition-all`}
              style={{ width: `${combinedPercent}%` }}
            />
          </div>
        )}
      </section>

      {/* Tool cards */}
      <section className="grid gap-px bg-black/10 md:grid-cols-2">
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
      <section className="grid gap-10 lg:grid-cols-2">
        {/* FF&E rooms */}
        <div>
          <h3 className="eyebrow mb-3">FF&amp;E by room</h3>
          <div className="bg-paper border-y border-black/10">
            <table className="w-full text-sm">
              <thead className="border-b border-black/10 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {roomsWithItems.map((room) => (
                  <tr key={room.id}>
                    <td className="px-4 py-2.5 font-medium text-neutral-950">{room.name}</td>
                    <td className="num px-4 py-2.5 text-right text-neutral-700">
                      {room.items.length}
                    </td>
                    <td className="num px-4 py-2.5 text-right font-medium text-neutral-950">
                      {formatMoney(cents(roomSubtotalCents(room.items)))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-brand-700/40 bg-brand-50/50">
                  <td className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                    Total
                  </td>
                  <td className="px-4 py-3" />
                  <td className="num px-4 py-3 text-right text-base font-semibold tracking-tight text-brand-700">
                    {formatMoney(cents(ffeActualCents))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 pt-4">
            {itemStatuses.map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <StatusBadge status={s} />
                <span className="num text-xs text-neutral-500">{statusCounts[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Proposal categories */}
        <div>
          <h3 className="eyebrow mb-3">Proposal by category</h3>
          <div className="bg-paper border-y border-black/10">
            <table className="w-full text-sm">
              <thead className="border-b border-black/10 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Rows</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {proposalCategoriesWithItems.map((category) => (
                  <tr key={category.id}>
                    <td className="px-4 py-2.5 font-medium text-neutral-950">{category.name}</td>
                    <td className="num px-4 py-2.5 text-right text-neutral-700">
                      {category.items.length}
                    </td>
                    <td className="num px-4 py-2.5 text-right text-neutral-700">
                      {category.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="num px-4 py-2.5 text-right font-medium text-neutral-950">
                      {formatMoney(cents(proposalCategorySubtotalCents(category.items)))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-brand-700/40 bg-brand-50/50">
                  <td className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                    Total
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="num px-4 py-3 text-right text-base font-semibold tracking-tight text-brand-700">
                    {formatMoney(cents(proposalActualCents))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
    <div className="bg-canvas-chrome p-5">
      <div className="flex items-center justify-between">
        <h3 className="eyebrow">{label}</h3>
        <Link
          to={linkTo}
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700 hover:text-brand-800"
        >
          View →
        </Link>
      </div>
      <p className="num mt-2 font-display text-2xl font-semibold tracking-tight text-neutral-950">
        {formatMoney(cents(actualCents))}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        <span className="num text-neutral-700">{itemCount}</span> {itemLabel}
        {hasBudget && (
          <>
            {' · '}
            <span className="num text-neutral-700">{pct}%</span> of{' '}
            <span className="num">{formatMoney(cents(budgetCents))}</span>
          </>
        )}
      </p>
      {hasBudget && (
        <div className="mt-4 h-1 overflow-hidden bg-canvas-shell">
          <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
