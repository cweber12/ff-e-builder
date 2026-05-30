import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Project } from '../../types';
import { SaveStatusIndicator } from '../shared/SaveStatusIndicator';
import { StudioMark } from '../shared/auth/AuthGate';
import type { SaveState } from '../../hooks/shared/useSaveStatus';

// ---------------------------------------------------------------------------
// Skeleton (three-row height = 44px + 44px + 44px = 132px)
// ---------------------------------------------------------------------------
function SkeletonBar() {
  return (
    <div className="shrink-0">
      <div className="flex h-11 items-center gap-3 bg-white px-4 md:px-6">
        <StudioMark />
        <span aria-hidden className="mx-2 h-4 w-px bg-neutral-200" />
        <div className="h-2.5 w-16 animate-pulse bg-neutral-100" />
        <div className="h-4 w-40 animate-pulse bg-neutral-100" />
      </div>
      <div className="flex h-11 items-center gap-4 border-b border-neutral-200 bg-white px-4 md:px-6">
        {[80, 64, 56, 72, 56].map((w, i) => (
          <div key={i} className="h-3 animate-pulse bg-neutral-100" style={{ width: w }} />
        ))}
      </div>
      <div className="flex h-11 items-center border-b border-neutral-200 bg-white px-4 md:px-6">
        <div className="h-3 w-20 animate-pulse bg-neutral-100" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------
type HeaderTab = {
  label: string;
  href: (id: string) => string;
  isActive: (id: string, pathname: string) => boolean;
};

const TABS: HeaderTab[] = [
  {
    label: 'FF&E',
    href: (id: string) => `/projects/${id}/ffe/table`,
    isActive: (id: string, pathname: string) => pathname.includes(`/projects/${id}/ffe`),
  },
  {
    label: 'Proposal',
    href: (id: string) => `/projects/${id}/proposal/table`,
    isActive: (id: string, pathname: string) => pathname.includes(`/projects/${id}/proposal`),
  },
  {
    label: 'Plans',
    href: (id: string) => `/projects/${id}/plans`,
    isActive: (id: string, pathname: string) => pathname.includes(`/projects/${id}/plans`),
  },
  {
    label: 'Materials',
    href: (id: string) => `/projects/${id}/materials`,
    isActive: (id: string, pathname: string) => pathname.includes(`/projects/${id}/materials`),
  },
  {
    label: 'Budget',
    href: (id: string) => `/projects/${id}/budget`,
    isActive: (id: string, pathname: string) => pathname.endsWith(`/projects/${id}/budget`),
  },
];

function TabNav({ projectId, activeLabel }: { projectId: string; activeLabel?: string }) {
  return (
    <nav aria-label="Project tools" className="flex items-stretch">
      {TABS.map(({ label, href }) => {
        const isActive = label === activeLabel;
        return (
          <Link
            key={label}
            to={href(projectId)}
            aria-current={isActive ? 'page' : undefined}
            data-active={isActive || undefined}
            className="relative inline-flex h-11 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:text-neutral-900 data-[active]:text-neutral-950 after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:bg-brand-500 after:opacity-0 after:transition-opacity data-[active]:after:opacity-100"
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ProjectHeaderProps {
  project: Project | undefined;
  /** Rendered in the right side of the working bar (actions cluster). */
  actions?: ReactNode;
  /** Optional account/user menu, rendered on the far right of the top row.
   *  Passed in as a slot so this component remains testable without auth. */
  userMenu?: ReactNode;
  saveState?: SaveState;
  saveRelTime?: string | null;
  onSaveRetry?: (() => void) | null;
  /** Optional content rendered beside the left toolbar title. */
  toolbarLeft?: ReactNode;
  /** Optional centered content for the toolbar row (e.g., catalog page picker). */
  toolbarCenter?: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProjectHeader({
  project,
  actions,
  userMenu,
  saveState = 'idle',
  saveRelTime = null,
  onSaveRetry = null,
  toolbarLeft,
  toolbarCenter,
}: ProjectHeaderProps) {
  const location = useLocation();

  if (!project) return <SkeletonBar />;

  const isFfeRoute = location.pathname.includes(`/projects/${project.id}/ffe`);
  const isCatalogRoute = location.pathname.includes('/ffe/catalog');
  const showViewToggle = isFfeRoute;
  const activeTab = TABS.find((tab) => tab.isActive(project.id, location.pathname));

  return (
    <header className="no-print relative z-10 shrink-0 overflow-visible">
      <div className="flex h-11 items-center gap-3 bg-white px-4 md:px-6">
        <StudioMark />
        <span aria-hidden className="mx-1 h-4 w-px bg-neutral-200" />
        <Link to="/projects" className="eyebrow shrink-0 transition-colors hover:text-brand-700">
          Projects
        </Link>
        <span className="text-xs text-neutral-300" aria-hidden="true">
          /
        </span>
        <Link
          to={`/projects/${project.id}`}
          className="min-w-0 truncate font-display text-[15px] font-semibold leading-none tracking-tight text-neutral-950 transition-colors hover:text-brand-700"
          title={project.name}
        >
          {project.name}
        </Link>
        <div className="ml-auto flex items-center gap-2">{userMenu}</div>
      </div>

      <div className="flex h-11 items-center border-b border-neutral-200 bg-white px-4 md:px-6">
        <TabNav projectId={project.id} {...(activeTab ? { activeLabel: activeTab.label } : {})} />
      </div>

      <div className="relative flex h-11 items-center border-b border-neutral-300 bg-white px-4 md:px-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-900">
          {activeTab?.label ?? 'Project'}
        </h2>

        {toolbarLeft}

        {showViewToggle && (
          <div className="toolbar-segmented ml-4">
            <Link
              to={`/projects/${project.id}/ffe/catalog`}
              data-active={isCatalogRoute || undefined}
              className="no-underline"
            >
              Catalog
            </Link>
            <Link
              to={`/projects/${project.id}/ffe/table`}
              data-active={!isCatalogRoute || undefined}
              className="no-underline"
            >
              Table
            </Link>
          </div>
        )}

        {toolbarCenter ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="pointer-events-auto">{toolbarCenter}</div>
          </div>
        ) : null}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          <SaveStatusIndicator state={saveState} relTime={saveRelTime} errorAction={onSaveRetry} />
          {actions}
        </div>
      </div>
    </header>
  );
}
