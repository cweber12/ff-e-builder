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
    <aside className="no-print flex w-full shrink-0 flex-col border-b border-neutral-200 bg-white lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <StudioMark />
          <div className="h-2.5 w-24 animate-pulse bg-neutral-100" />
        </div>
      </div>
      <div className="space-y-5 px-5 py-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-neutral-100" />
        ))}
      </div>
      <div className="mt-auto border-t border-neutral-200 px-5 py-4">
        <div className="h-3 w-32 animate-pulse bg-neutral-100" />
      </div>
    </aside>
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
    <nav aria-label="Project tools" className="flex flex-col gap-1">
      {TABS.map(({ label, href }) => {
        const isActive = label === activeLabel;
        return (
          <Link
            key={label}
            to={href(projectId)}
            aria-current={isActive ? 'page' : undefined}
            data-active={isActive || undefined}
            className="inline-flex h-9 items-center rounded-md px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 data-[active]:bg-neutral-100 data-[active]:font-bold data-[active]:text-neutral-950"
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
    <aside className="no-print flex w-full shrink-0 flex-col border-b border-neutral-200 bg-white lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <StudioMark />
          <span aria-hidden className="h-4 w-px bg-neutral-200" />
          <Link to="/projects" className="eyebrow shrink-0 transition-colors hover:text-brand-700">
            Projects
          </Link>
        </div>
        <Link
          to={`/projects/${project.id}`}
          className="mt-3 block truncate font-display text-[15px] font-semibold leading-none tracking-tight text-neutral-950 transition-colors hover:text-brand-700"
          title={project.name}
        >
          {project.name}
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4">
          <TabNav projectId={project.id} {...(activeTab ? { activeLabel: activeTab.label } : {})} />
        </div>

        <div className="space-y-4 border-t border-neutral-200 pt-4">
          {toolbarLeft}

          {showViewToggle && (
            <div className="toolbar-segmented">
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

          {toolbarCenter}

          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3">
        <div className="flex items-center gap-1">
          <SaveStatusIndicator state={saveState} relTime={saveRelTime} errorAction={onSaveRetry} />
        </div>
        <div className="flex items-center gap-2">{userMenu}</div>
      </div>
    </aside>
  );
}
