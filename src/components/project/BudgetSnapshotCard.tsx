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
  const hasBudget = summary.combinedBudgetCents > 0;
  const isOverBudget = hasBudget && summary.combinedActualCents > summary.combinedBudgetCents;
  const combinedFill = hasBudget ? Math.min(summary.combinedPercent, 100) : 0;

  return (
    <section className="py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Budget</p>
          <p className="font-display mt-1 text-4xl font-semibold text-neutral-900">
            {formatMoney(cents(summary.combinedActualCents))}
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            {hasBudget
              ? `of ${formatMoney(cents(summary.combinedBudgetCents))} · ${isOverBudget ? 'over budget' : `${summary.combinedPercent}%`}`
              : 'No budget target set'}
          </p>
        </div>
        {isOverBudget && (
          <span className="mt-1 rounded-full bg-danger-500/10 px-2.5 py-1 text-xs font-semibold text-danger-600">
            Over Budget
          </span>
        )}
      </div>

      {hasBudget && (
        <div className="mt-5 space-y-4">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${isOverBudget ? 'bg-danger-500' : 'bg-brand-500'}`}
              style={{ width: `${combinedFill}%` }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <BudgetSubBar
              label="FF&E"
              actualCents={summary.ffeActualCents}
              budgetCents={summary.ffeBudgetCents}
              pct={Math.min(summary.ffePercent, 100)}
              isOver={summary.ffeActualCents > summary.ffeBudgetCents}
            />
            <BudgetSubBar
              label="Proposal"
              actualCents={summary.proposalActualCents}
              budgetCents={summary.proposalBudgetCents}
              pct={Math.min(summary.proposalPercent, 100)}
              isOver={summary.proposalActualCents > summary.proposalBudgetCents}
            />
          </div>
        </div>
      )}

      <div className="mt-6">
        <Link
          to={`/projects/${project.id}/budget`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 transition-colors hover:text-brand-700"
        >
          View Budget
          <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}

function BudgetSubBar({
  label,
  actualCents,
  budgetCents,
  pct,
  isOver,
}: {
  label: string;
  actualCents: number;
  budgetCents: number;
  pct: number;
  isOver: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-neutral-500">{label}</span>
        <span
          className={`text-xs font-semibold ${isOver ? 'text-danger-500' : 'text-neutral-700'}`}
        >
          {formatMoney(cents(actualCents))}
          {budgetCents > 0 && (
            <span className="ml-1 font-normal text-neutral-400">
              / {formatMoney(cents(budgetCents))}
            </span>
          )}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full ${isOver ? 'bg-danger-500' : 'bg-brand-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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
