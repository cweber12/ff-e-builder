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
  const remainingColor =
    remainingCents < 0
      ? 'text-danger-600'
      : remainingCents < budgetCents * BUDGET_WARNING_PCT
        ? 'text-warning-500'
        : 'text-brand-700';

  return (
    <div className="relative flex items-center justify-end">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide budget information' : 'Show budget information'}
        onClick={() => setExpanded((open) => !open)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/12 text-white ring-1 ring-white/20 transition hover:bg-white/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
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
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-gray-200 bg-white p-4 text-gray-950 shadow-xl">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-950">Budget</h2>
              <p className="text-xs text-gray-500">
                {budgetCents > 0 ? `${budgetPercent}% committed` : 'No budget set'}
              </p>
            </div>
            <InlineNumberEdit
              value={budgetCents / 100}
              onSave={(dollars) => onBudgetSave(dollarsToCents(dollars))}
              formatter={(d) => (d > 0 ? formatMoney(cents(d * 100)) : 'Set budget')}
              aria-label={budgetCents > 0 ? 'Project budget' : 'Set budget'}
              className="justify-end text-sm font-semibold text-brand-700"
            />
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-pill bg-gray-100">
            <div
              className={cn(
                'h-full rounded-pill',
                remainingCents < 0
                  ? 'bg-danger-500'
                  : budgetPercent >= 90
                    ? 'bg-warning-500'
                    : 'bg-brand-500',
              )}
              style={{ width: `${budgetCents > 0 ? budgetPercent : 0}%` }}
            />
          </div>
          <dl className="grid gap-2 text-sm tabular-nums">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Actual</dt>
              <dd className="font-medium text-gray-950">{formatMoney(cents(actualCents))}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
              <dt className="text-gray-500">Remaining</dt>
              <dd className={cn('flex items-center gap-1 font-semibold', remainingColor)}>
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
                {formatMoney(cents(Math.abs(remainingCents)))}
                {remainingCents < 0 && ' over'}
              </dd>
            </div>
          </dl>
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
