import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';
import { formatMoney, dollarsToCents, cents } from '../types';
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
  onBudgetSave: (cents: number) => Promise<void> | void;
}

function BudgetTracker({ budgetCents, actualCents, onBudgetSave }: BudgetTrackerProps) {
  const [expanded, setExpanded] = useState(true);
  const remainingCents = budgetCents - actualCents;
  const budgetPercent =
    budgetCents > 0 ? Math.min(Math.round((actualCents / budgetCents) * 100), 100) : 0;

  const BUDGET_WARNING_PCT = 0.1;
  const remainingHeaderColor =
    remainingCents < 0
      ? 'text-red-100'
      : remainingCents < budgetCents * BUDGET_WARNING_PCT
        ? 'text-amber-100'
        : 'text-white';

  return (
    <div className="flex h-10 items-center justify-end gap-3 text-white">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide budget information' : 'Show budget information'}
        title={expanded ? 'Hide budget information' : 'Show budget information'}
        onClick={() => setExpanded((open) => !open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M4.5 15V9.5m5.5 5.5V5m5.5 10v-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M3.5 16h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {expanded && (
        <div className="flex h-full items-center gap-4 text-xs tabular-nums text-white/85">
          <div className="flex items-baseline gap-1">
            <span className="text-white/55">Budget</span>
            <InlineNumberEdit
              value={budgetCents / 100}
              onSave={(dollars) => onBudgetSave(dollarsToCents(dollars))}
              formatter={(d) => (d > 0 ? formatMoney(cents(d * 100)) : 'Set budget')}
              aria-label={budgetCents > 0 ? 'Project budget' : 'Set budget'}
              className="justify-end text-xs font-semibold text-white"
            />
          </div>
          <div className="hidden items-baseline gap-1 sm:flex">
            <span className="text-white/55">Actual</span>
            <span className="font-semibold text-white">{formatMoney(cents(actualCents))}</span>
          </div>
          <div className="hidden items-baseline gap-1 md:flex">
            <span className="text-white/55">{remainingCents < 0 ? 'Over' : 'Remaining'}</span>
            <span
              className={cn('font-semibold', remainingHeaderColor)}
              aria-label={remainingCents < 0 ? 'Over budget' : 'Remaining budget'}
            >
              {formatMoney(cents(Math.abs(remainingCents)))}
            </span>
          </div>
          <span className="hidden text-white/55 lg:inline">{budgetPercent}% committed</span>
        </div>
      )}
    </div>
  );
}

// ─── ProjectHeader ────────────────────────────────────────────────────────────

interface ProjectHeaderProps {
  /** Undefined while the project is loading — renders skeleton. */
  project: Project | undefined;
  /** Live-derived actual spend for the project (integer cents). */
  actualCents: number;
  onNameSave: (name: string) => Promise<void> | void;
  onClientSave: (clientName: string) => Promise<void> | void;
  onBudgetSave: (budgetCents: number) => Promise<void> | void;
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
    <header className="no-print relative z-20 flex min-h-[6.5rem] flex-col gap-4 overflow-visible bg-brand-500 px-6 py-4 md:flex-row md:items-center md:justify-between">
      {/* Left: back link, project name, client */}
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          to="/projects"
          className="flex w-fit items-center gap-1 text-xs text-white/70 transition-colors hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3 shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
          All projects
        </Link>
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
              <span className="text-sm text-white">{v}</span>
            ) : (
              <span className="text-sm text-white italic">Add client name</span>
            )
          }
          className="text-sm text-white"
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
