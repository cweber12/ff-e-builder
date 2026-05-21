import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Project } from '../../types';
import { ProjectOptionsMenu } from './ProjectOptionsMenu';
import { SaveStatusIndicator } from '../shared/SaveStatusIndicator';
import type { SaveState } from '../../hooks/shared/useSaveStatus';

// ---------------------------------------------------------------------------
// Skeleton (two-row height = 40px + 48px = 88px)
// ---------------------------------------------------------------------------
function SkeletonBar() {
  return (
    <div className="shrink-0">
      <div className="flex h-10 items-center gap-3 border-b border-black/10 bg-canvas-chrome/95 px-4 backdrop-blur">
        <div className="h-2.5 w-16 animate-pulse bg-canvas-shell" />
        <div className="h-2.5 w-2 animate-pulse bg-canvas-shell" />
        <div className="h-4 w-40 animate-pulse bg-canvas-shell" />
      </div>
      <div className="flex h-12 items-center gap-4 border-b border-black/10 bg-canvas-chrome/95 px-4 backdrop-blur">
        {[80, 64, 56, 72, 56].map((w, i) => (
          <div key={i} className="h-3 animate-pulse bg-canvas-shell" style={{ width: w }} />
        ))}
      </div>
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
              'relative inline-flex h-12 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
              isActive ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              {label}
              {isActive && (
                <span
                  className="absolute inset-x-3 -bottom-px h-0.5 bg-brand-600"
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
  const isCatalogRoute = location.pathname.includes('/ffe/catalog');
  const showViewToggle = isFfeRoute;

  return (
    <header className="no-print relative z-10 shrink-0 overflow-visible">
      <div className="flex h-11 items-center gap-3 border-b border-black/10 bg-canvas-chrome/95 px-4 backdrop-blur">
        <Link to="/projects" className="eyebrow shrink-0 transition-colors hover:text-brand-700">
          Projects
        </Link>
        <span className="text-xs text-neutral-300" aria-hidden="true">
          /
        </span>
        <Link
          to={`/projects/${project.id}`}
          className="min-w-0 truncate font-display text-[18px] font-semibold leading-none tracking-tight text-neutral-950 transition-colors hover:text-brand-700"
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
            buttonClassName="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition hover:bg-canvas-shell hover:text-brand-700"
          />
        )}
      </div>

      <div className="flex h-12 items-center border-b border-black/10 bg-canvas-chrome/95 px-4 backdrop-blur">
        <TabNav projectId={project.id} />

        {showViewToggle && (
          <div className="ml-6 inline-flex border border-black/10 bg-canvas-shell p-0.5">
            <Link
              to={`/projects/${project.id}/ffe/catalog`}
              className={[
                'inline-flex h-7 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition',
                isCatalogRoute
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-500 hover:text-brand-700',
              ].join(' ')}
            >
              Catalog
            </Link>
            <Link
              to={`/projects/${project.id}/ffe/table`}
              className={[
                'inline-flex h-7 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition',
                !isCatalogRoute
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-500 hover:text-brand-700',
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
        </div>
      </div>
    </header>
  );
}
