import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar } from 'lucide-react';
import type { Project } from '../../types';
import { SaveStatusIndicator } from '../shared/SaveStatusIndicator';
import { StudioMark } from '../shared/auth/AuthGate';
import type { SaveState } from '../../hooks/shared/useSaveStatus';
import { ProjectToolNav } from './ProjectToolNav';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonBar() {
  return (
    <div className="shrink-0">
      <div className="flex h-11 items-center gap-3 bg-white px-4 md:px-6 lg:border-b lg:border-neutral-200">
        <StudioMark />
        <span aria-hidden className="mx-2 h-4 w-px bg-neutral-200" />
        <div className="h-2.5 w-16 animate-pulse bg-neutral-100" />
        <div className="h-4 w-40 animate-pulse bg-neutral-100" />
      </div>
      <div className="flex h-11 items-center gap-4 border-b border-neutral-200 bg-white px-4 md:px-6 lg:hidden">
        {[80, 64, 56, 72, 56].map((w, i) => (
          <div key={i} className="h-3 animate-pulse bg-neutral-100" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ProjectHeaderProps {
  project: Project | undefined;
  /** Optional account/user menu, rendered on the far right of the top row.
   *  Passed in as a slot so this component remains testable without auth. */
  userMenu?: ReactNode;
  saveState?: SaveState;
  saveRelTime?: string | null;
  onSaveRetry?: (() => void) | null;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: (() => void) | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProjectHeader({
  project,
  userMenu,
  saveState = 'idle',
  saveRelTime = null,
  onSaveRetry = null,
  sidebarCollapsed = false,
  onToggleSidebar = null,
}: ProjectHeaderProps) {
  if (!project) return <SkeletonBar />;

  return (
    <header data-project-header="true" className="no-print relative z-10 shrink-0 overflow-visible">
      <div
        data-project-header-top="true"
        className="flex h-11 items-center gap-3 bg-white px-4 md:px-6 lg:border-b lg:border-neutral-200"
      >
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
          <SaveStatusIndicator state={saveState} relTime={saveRelTime} errorAction={onSaveRetry} />
          {onToggleSidebar ? (
            <button
              type="button"
              className="icon-btn text-neutral-500 hover:text-neutral-950"
              aria-label={sidebarCollapsed ? 'Open project sidebar' : 'Collapse project sidebar'}
              aria-expanded={!sidebarCollapsed}
              aria-controls="project-tab-toolbar-sidebar"
              onClick={onToggleSidebar}
              title={sidebarCollapsed ? 'Open project sidebar' : 'Collapse project sidebar'}
            >
              <Sidebar className="toolbar-icon" aria-hidden="true" />
            </button>
          ) : null}
          {userMenu}
        </div>
      </div>

      <div
        data-project-header-tabs="true"
        className="grid h-11 grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-200 bg-white px-4 md:px-6 lg:hidden"
      >
        <div aria-hidden="true" />
        <div className="justify-self-center">
          <ProjectToolNav projectId={project.id} />
        </div>
        <div aria-hidden="true" />
      </div>
    </header>
  );
}
