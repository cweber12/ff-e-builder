import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Project } from '../../types';
import { ProjectOptionsMenu } from './ProjectOptionsMenu';
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
      {TABS.filter(({ label }) => label !== activeLabel).map(({ label, href }) => (
        <Link
          key={label}
          to={href(projectId)}
          className="inline-flex h-11 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:text-neutral-900"
        >
          {label}
        </Link>
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
  optionsOpen = false,
  onToggleOptions,
  onEditProject,
  onProjectImages,
  onDeleteProject,
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
        <div className="ml-auto flex items-center gap-2">
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
              buttonClassName="inline-flex h-7 w-7 items-center justify-center rounded-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-brand-700"
            />
          )}
          {userMenu}
        </div>
      </div>

      <div className="flex h-11 items-center border-b border-neutral-200 bg-white px-4 md:px-6">
        <TabNav projectId={project.id} {...(activeTab ? { activeLabel: activeTab.label } : {})} />
      </div>

      <div className="relative flex h-11 items-center border-b border-neutral-200 bg-white px-4 md:px-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-900">
          {activeTab?.label ?? 'Project'}
        </h2>

        {toolbarLeft}

        {showViewToggle && (
          <div className="segmented ml-4">
            <Link
              to={`/projects/${project.id}/ffe/catalog`}
              data-active={isCatalogRoute || undefined}
              className="inline-flex h-7 items-center rounded-[4px] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600 transition-colors data-[active=true]:bg-brand-600 data-[active=true]:text-white hover:bg-neutral-100"
            >
              Catalog
            </Link>
            <Link
              to={`/projects/${project.id}/ffe/table`}
              data-active={!isCatalogRoute || undefined}
              className="inline-flex h-7 items-center rounded-[4px] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600 transition-colors data-[active=true]:bg-brand-600 data-[active=true]:text-white hover:bg-neutral-100"
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
