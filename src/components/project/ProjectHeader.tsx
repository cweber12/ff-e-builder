import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
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
      <div className="project-header-topbar">
        <StudioMark />
        <span aria-hidden className="mx-2 h-4 w-px bg-neutral-200" />
        <div className="h-2.5 w-16 animate-pulse bg-neutral-100" />
        <div className="h-4 w-40 animate-pulse bg-neutral-100" />
      </div>
      <div className="project-header-tabs lg:hidden">
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
  /** Whether the active tool exposes controls worth a mobile panel toggle. */
  hasToolPanel?: boolean;
  toolPanelOpen?: boolean;
  onToggleToolPanel?: (() => void) | null;
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
  hasToolPanel = false,
  toolPanelOpen = false,
  onToggleToolPanel = null,
}: ProjectHeaderProps) {
  if (!project) return <SkeletonBar />;

  return (
    <header
      data-project-header="true"
      className="no-print fixed inset-x-0 top-0 z-30 shrink-0 overflow-visible"
    >
      <div data-project-header-top="true" className="project-header-topbar">
        <StudioMark />
        <span aria-hidden className="mx-1 h-4 w-px bg-neutral-200" />
        <Link to="/projects" className="project-header-crumb shrink-0">
          Projects
        </Link>
        <span className="text-xs text-neutral-400" aria-hidden="true">
          /
        </span>
        <Link
          to={`/projects/${project.id}`}
          className="project-header-project-link"
          title={project.name}
        >
          {project.name}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <SaveStatusIndicator state={saveState} relTime={saveRelTime} errorAction={onSaveRetry} />
          {userMenu}
        </div>
      </div>

      <div data-project-header-tabs="true" className="project-header-tabs lg:hidden">
        <div aria-hidden="true" />
        <div className="justify-self-center">
          <ProjectToolNav projectId={project.id} />
        </div>
        <div className="justify-self-end">
          {hasToolPanel && onToggleToolPanel ? (
            <button
              type="button"
              className="project-tool-options-trigger"
              aria-label={toolPanelOpen ? 'Hide tool options' : 'Show tool options'}
              aria-expanded={toolPanelOpen}
              aria-controls="project-tool-panel"
              onClick={onToggleToolPanel}
            >
              <Menu className="toolbar-icon" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
