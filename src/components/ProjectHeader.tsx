import { cn } from '../lib/cn';
import { formatMoney, dollarsToCents } from '../types';
import type { Project } from '../types';
import { InlineTextEdit } from './primitives/InlineTextEdit';
import { InlineNumberEdit } from './primitives/InlineNumberEdit';

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBar() {
  return (
    <div className="bg-brand-500 px-6 py-4 flex items-center justify-between animate-pulse">
      {/* Left side: name + client */}
      <div className="flex flex-col gap-2">
        <div className="h-6 w-48 rounded bg-white/20" />
        <div className="h-4 w-32 rounded bg-white/15" />
      </div>
      {/* Right side: budget tracker */}
      <div className="flex flex-col items-end gap-2">
        <div className="h-4 w-36 rounded bg-white/20" />
        <div className="h-4 w-36 rounded bg-white/15" />
        <div className="h-4 w-36 rounded bg-white/15" />
      </div>
    </div>
  );
}

// ─── Budget tracker ───────────────────────────────────────────────────────────

interface BudgetTrackerProps {
  budgetCents: number;
  actualCents: number;
  onBudgetSave: (cents: number) => Promise<void>;
}

function BudgetTracker({ budgetCents, actualCents, onBudgetSave }: BudgetTrackerProps) {
  const remainingCents = budgetCents - actualCents;

  const remainingColor =
    remainingCents < 0
      ? 'text-red-300'
      : remainingCents < budgetCents * 0.1
        ? 'text-amber-300'
        : 'text-emerald-300';

  if (budgetCents === 0) {
    return (
      <InlineNumberEdit
        value={0}
        onSave={(dollars) => onBudgetSave(dollarsToCents(dollars))}
        formatter={() => 'Set budget'}
        aria-label="Set project budget"
        className="text-white/70 hover:text-white cursor-pointer text-sm underline underline-offset-2"
      />
    );
  }

  return (
    <dl className="flex flex-col items-end gap-0.5 text-sm tabular-nums">
      <div className="flex items-center gap-3">
        <dt className="text-white/70 w-20 text-right">Budget</dt>
        <dd className="text-white font-medium">
          <InlineNumberEdit
            value={budgetCents / 100}
            onSave={(dollars) => onBudgetSave(dollarsToCents(dollars))}
            formatter={(d) => formatMoney((d * 100) as Parameters<typeof formatMoney>[0])}
            aria-label="Project budget"
            className="text-white"
          />
        </dd>
      </div>
      <div className="flex items-center gap-3">
        <dt className="text-white/70 w-20 text-right">Actual</dt>
        <dd className="text-white font-medium">
          {formatMoney(actualCents as Parameters<typeof formatMoney>[0])}
        </dd>
      </div>
      <div className="flex items-center gap-3">
        <dt className="text-white/70 w-20 text-right">Remaining</dt>
        <dd className={cn('font-medium flex items-center gap-1', remainingColor)}>
          {remainingCents < 0 && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3.5 w-3.5 flex-shrink-0"
              aria-label="Over budget"
            >
              <path
                fillRule="evenodd"
                d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {formatMoney(Math.abs(remainingCents) as Parameters<typeof formatMoney>[0])}
          {remainingCents < 0 && ' over'}
        </dd>
      </div>
    </dl>
  );
}

// ─── ProjectHeader ────────────────────────────────────────────────────────────

interface ProjectHeaderProps {
  /** Undefined while the project is loading — renders skeleton. */
  project: Project | undefined;
  /** Live-derived actual spend for the project (integer cents). */
  actualCents: number;
  onNameSave: (name: string) => Promise<void>;
  onClientSave: (clientName: string) => Promise<void>;
  onBudgetSave: (budgetCents: number) => Promise<void>;
}

export function ProjectHeader({
  project,
  actualCents,
  onNameSave,
  onClientSave,
  onBudgetSave,
}: ProjectHeaderProps) {
  if (!project) return <SkeletonBar />;

  return (
    <header className="bg-brand-500 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      {/* Left: project name + client */}
      <div className="flex flex-col gap-1 min-w-0">
        <InlineTextEdit
          value={project.name}
          onSave={onNameSave}
          aria-label="Project name"
          renderDisplay={(v) => (
            <span className="text-xl font-semibold text-white truncate">{v}</span>
          )}
          className="text-xl font-semibold text-white"
          inputClassName="text-xl font-semibold bg-brand-600 text-white border-white/30 placeholder-white/50"
        />
        <InlineTextEdit
          value={project.clientName}
          onSave={onClientSave}
          placeholder="Add client name"
          aria-label="Client name"
          renderDisplay={(v) =>
            v ? (
              <span className="text-sm text-white/80">{v}</span>
            ) : (
              <span className="text-sm text-white/50 italic">Add client name</span>
            )
          }
          className="text-sm text-white/80"
          inputClassName="text-sm bg-brand-600 text-white border-white/30 placeholder-white/50"
        />
      </div>

      {/* Right: budget tracker */}
      <BudgetTracker
        budgetCents={project.budgetCents}
        actualCents={actualCents}
        onBudgetSave={onBudgetSave}
      />
    </header>
  );
}
