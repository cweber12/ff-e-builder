import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Project } from '../../types';
import { ProjectOptionsMenu } from './ProjectOptionsMenu';
import { SaveStatusIndicator } from '../shared/SaveStatusIndicator';
import type { SaveState } from '../../hooks/useSaveStatus';

// ---------------------------------------------------------------------------
// Skeleton (two-row height = 40px + 48px = 88px)
// ---------------------------------------------------------------------------
function SkeletonBar() {
  return (
    <div className="shrink-0">
      <div className="flex h-10 items-center gap-3 border-b border-neutral-200 bg-surface px-4">
        <div className="h-2.5 w-16 rounded-sm bg-neutral-200" />
        <div className="h-2.5 w-2 rounded-sm bg-neutral-200" />
        <div className="h-4 w-40 rounded-sm bg-neutral-200" />
      </div>
      <div className="flex h-12 items-center gap-4 border-b border-neutral-200 bg-surface px-4">
        {[80, 64, 56, 72, 56].map((w, i) => (
          <div key={i} className="h-3 rounded-sm bg-neutral-100" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyboard hint strip
// ---------------------------------------------------------------------------
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block min-w-[14px] rounded-sm border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[9px] text-neutral-600">
      {children}
    </kbd>
  );
}

function KeyboardHints() {
  return (
    <div className="ml-3 hidden items-center gap-3 font-mono text-[10px] text-neutral-400 lg:inline-flex">
      <span>
        <Kbd>↑↓</Kbd> nav
      </span>
      <span>
        <Kbd>↵</Kbd> edit
      </span>
      <span>
        <Kbd>⌘K</Kbd> find
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------
const TABS = [
  { label: 'FF&E', href: (id: string) => `/projects/${id}/ffe/table` },
  { label: 'Proposal', href: (id: string) => `/projects/${id}/proposal/table` },
  { label: 'Plans', href: (id: string) => `/projects/${id}/plans` },
  { label: 'Materials', href: (id: string) => `/projects/${id}/materials` },
  { label: 'Budget', href: (id: string) => `/projects/${id}/budget` },
];

function TabNav({ projectId }: { projectId: string }) {
  return (
    <nav aria-label="Project tools" className="flex items-stretch">
      {TABS.map(({ label, href }) => (
        <NavLink
          key={label}
          to={href(projectId)}
          className={({ isActive }) =>
            [
              'relative inline-flex h-12 items-center px-3 text-sm font-medium transition-colors',
              isActive ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              {label}
              {isActive && (
                <span
                  className="absolute inset-x-3 -bottom-px h-0.5 bg-brand-500"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ProjectHeaderProps {
  project: Project | undefined;
  optionsOpen?: boolean;
  onToggleOptions?: () => void;
  onEditProject?: () => void;
  onProjectImages?: () => void;
  onDeleteProject?: () => void;
  /** Rendered in the right side of the working bar (actions cluster). */
  actions?: ReactNode;
  saveState?: SaveState;
  saveRelTime?: string | null;
  onSaveRetry?: (() => void) | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProjectHeader({
  project,
  optionsOpen = false,
  onToggleOptions,
  onEditProject,
  onProjectImages,
  onDeleteProject,
  actions,
  saveState = 'idle',
  saveRelTime = null,
  onSaveRetry = null,
}: ProjectHeaderProps) {
  const location = useLocation();

  if (!project) return <SkeletonBar />;

  const isFfeRoute = location.pathname.includes(`/projects/${project.id}/ffe`);
  const isProposalRoute = location.pathname.includes(`/projects/${project.id}/proposal`);
  const isCatalogRoute = location.pathname.includes('/ffe/catalog');
  const showViewToggle = isFfeRoute;
  const showKeyboardHints = isFfeRoute || isProposalRoute;

  return (
    <header className="no-print relative z-10 shrink-0 overflow-visible">
      {/* ── Row 1: Identity ───────────────────────────────────────── */}
      <div className="flex h-10 items-center gap-3 border-b border-neutral-200 bg-surface px-4">
        <Link
          to="/projects"
          className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Projects
        </Link>
        <span className="text-xs text-neutral-300" aria-hidden="true">
          /
        </span>
        <Link
          to={`/projects/${project.id}`}
          className="min-w-0 truncate font-display text-[22px] font-normal leading-none text-neutral-900 transition-colors hover:text-brand-600"
          title={project.name}
        >
          {project.name}
        </Link>
        <div className="ml-auto" />
        {onToggleOptions && onEditProject && onProjectImages && onDeleteProject && (
          <ProjectOptionsMenu
            projectId={project.id}
            projectName={project.name}
            open={optionsOpen}
            align="bottom"
            onToggle={onToggleOptions}
            onEdit={onEditProject}
            onImages={onProjectImages}
            onDelete={onDeleteProject}
            buttonClassName="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          />
        )}
      </div>

      {/* ── Row 2: Working bar ────────────────────────────────────── */}
      <div className="flex h-12 items-center border-b border-neutral-200 bg-surface px-4">
        <TabNav projectId={project.id} />

        {/* View toggle (FF&E only) */}
        {showViewToggle && (
          <div className="ml-6 inline-flex rounded-md bg-neutral-100 p-0.5">
            <Link
              to={`/projects/${project.id}/ffe/catalog`}
              className={[
                'inline-flex h-8 items-center rounded-[5px] px-3 text-xs font-medium transition',
                isCatalogRoute
                  ? 'bg-surface text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900',
              ].join(' ')}
            >
              Catalog
            </Link>
            <Link
              to={`/projects/${project.id}/ffe/table`}
              className={[
                'inline-flex h-8 items-center rounded-[5px] px-3 text-xs font-medium transition',
                !isCatalogRoute
                  ? 'bg-surface text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900',
              ].join(' ')}
            >
              Table
            </Link>
          </div>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          <SaveStatusIndicator state={saveState} relTime={saveRelTime} errorAction={onSaveRetry} />
          {actions}
          {showKeyboardHints && <KeyboardHints />}
        </div>
      </div>
    </header>
  );
}
