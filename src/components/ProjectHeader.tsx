import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
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
  ffeBudgetCents: number;
  takeoffBudgetCents: number;
  budgetMode: NonNullable<Project['budgetMode']>;
  actualCents: number;
  onBudgetSave: (cents: number) => Promise<void> | void;
  onFfeBudgetSave: (cents: number) => Promise<void> | void;
  onTakeoffBudgetSave: (cents: number) => Promise<void> | void;
  onBudgetModeSave: (mode: NonNullable<Project['budgetMode']>) => Promise<void> | void;
}

function BudgetTracker({
  budgetCents,
  ffeBudgetCents,
  takeoffBudgetCents,
  budgetMode,
  actualCents,
  onBudgetSave,
  onFfeBudgetSave,
  onTakeoffBudgetSave,
  onBudgetModeSave,
}: BudgetTrackerProps) {
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
    <div className="flex items-start justify-end gap-3 text-white">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide budget information' : 'Show budget information'}
        title={expanded ? 'Hide budget information' : 'Show budget information'}
        onClick={() => setExpanded((open) => !open)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4.25 6.75A2.25 2.25 0 0 1 6.5 4.5h7A2.25 2.25 0 0 1 15.75 6.75v6.5A2.25 2.25 0 0 1 13.5 15.5h-7a2.25 2.25 0 0 1-2.25-2.25v-6.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M13 9.25h2.75v3.5H13a1.75 1.75 0 1 1 0-3.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M6.5 4.5 12.25 2.75"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col items-end gap-1 text-xs tabular-nums text-white/85">
          <div className="flex items-baseline gap-1">
            <span className="text-white/55">Budget</span>
            <InlineNumberEdit
              value={(budgetMode === 'shared' ? budgetCents : ffeBudgetCents) / 100}
              onSave={(dollars) =>
                budgetMode === 'shared'
                  ? onBudgetSave(dollarsToCents(dollars))
                  : onFfeBudgetSave(dollarsToCents(dollars))
              }
              formatter={(d) => (d > 0 ? formatMoney(cents(d * 100)) : 'Set budget')}
              aria-label={budgetMode === 'shared' ? 'Project budget' : 'FF&E budget'}
              className="justify-end text-xs font-semibold text-white"
            />
          </div>
          {budgetMode === 'individual' && (
            <div className="hidden items-baseline gap-1 xl:flex">
              <span className="text-white/55">Take-Off</span>
              <InlineNumberEdit
                value={takeoffBudgetCents / 100}
                onSave={(dollars) => onTakeoffBudgetSave(dollarsToCents(dollars))}
                formatter={(d) => (d > 0 ? formatMoney(cents(d * 100)) : 'Set budget')}
                aria-label="Take-off budget"
                className="justify-end text-xs font-semibold text-white"
              />
            </div>
          )}
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
          <button
            type="button"
            className="hidden rounded border border-white/20 px-2 py-1 text-[11px] font-semibold text-white/80 transition hover:bg-white/10 md:inline-flex"
            onClick={() => {
              void onBudgetModeSave(budgetMode === 'shared' ? 'individual' : 'shared');
            }}
          >
            {budgetMode === 'shared' ? 'Shared' : 'Individual'}
          </button>
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
  onCompanySave?: (companyName: string) => Promise<void> | void;
  onLocationSave?: (projectLocation: string) => Promise<void> | void;
  onBudgetSave: (budgetCents: number) => Promise<void> | void;
  onFfeBudgetSave?: (budgetCents: number) => Promise<void> | void;
  onTakeoffBudgetSave?: (budgetCents: number) => Promise<void> | void;
  onBudgetModeSave?: (mode: NonNullable<Project['budgetMode']>) => Promise<void> | void;
}

export function ProjectHeader({
  project,
  actualCents,
  onNameSave,
  onClientSave,
  onCompanySave = () => undefined,
  onLocationSave = () => undefined,
  onBudgetSave,
  onFfeBudgetSave = () => undefined,
  onTakeoffBudgetSave = () => undefined,
  onBudgetModeSave = () => undefined,
}: ProjectHeaderProps) {
  if (!project) return <SkeletonBar />;

  return (
    <header className="no-print relative z-20 overflow-visible bg-brand-500 px-6 py-4">
      <div className="flex min-h-[6.5rem] flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
              <span className="truncate text-xl font-semibold text-white">{v}</span>
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
                <span className="text-sm italic text-white">Add client name</span>
              )
            }
            className="text-sm text-white"
            inputClassName="text-sm bg-brand-600 text-white border-white/30 placeholder-white/50"
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <InlineTextEdit
              value={project.companyName ?? ''}
              onSave={onCompanySave}
              placeholder="Add company"
              aria-label="Company"
              renderDisplay={(v) => (
                <span className="text-xs text-white/85">{v ? `Company: ${v}` : 'Add company'}</span>
              )}
              className="text-xs text-white/85"
              inputClassName="text-xs bg-brand-600 text-white border-white/30 placeholder-white/50"
            />
            <InlineTextEdit
              value={project.projectLocation ?? ''}
              onSave={onLocationSave}
              placeholder="Add location"
              aria-label="Project location"
              renderDisplay={(v) => (
                <span className="text-xs text-white/85">
                  {v ? `Location: ${v}` : 'Add location'}
                </span>
              )}
              className="text-xs text-white/85"
              inputClassName="text-xs bg-brand-600 text-white border-white/30 placeholder-white/50"
            />
          </div>
        </div>

        <BudgetTracker
          budgetCents={project.budgetCents}
          ffeBudgetCents={project.ffeBudgetCents ?? 0}
          takeoffBudgetCents={project.takeoffBudgetCents ?? 0}
          budgetMode={project.budgetMode ?? 'shared'}
          actualCents={actualCents}
          onBudgetSave={onBudgetSave}
          onFfeBudgetSave={onFfeBudgetSave}
          onTakeoffBudgetSave={onTakeoffBudgetSave}
          onBudgetModeSave={onBudgetModeSave}
        />
      </div>

      <nav aria-label="Project tools" className="mt-3 flex gap-2 overflow-x-auto">
        {(
          [
            [`/projects/${project.id}/ffe/table`, 'FF&E'],
            [`/projects/${project.id}/takeoff/table`, 'Take-Off Table'],
          ] as const
        ).map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-1.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-white/75 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
