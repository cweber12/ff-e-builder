import { Link, NavLink } from 'react-router-dom';
import type { Project } from '../../types';
import { ProjectOptionsMenu } from './ProjectOptionsMenu';

function SkeletonBar() {
  return (
    <div className="flex animate-pulse items-center justify-between bg-brand-500 px-6 py-3">
      <div className="flex flex-col gap-2">
        <div className="h-5 w-48 rounded bg-white/20" />
        <div className="h-3 w-64 rounded bg-white/15" />
      </div>
      <div className="hidden gap-2 sm:flex">
        <div className="h-8 w-20 rounded-md bg-white/20" />
        <div className="h-8 w-32 rounded-md bg-white/15" />
      </div>
    </div>
  );
}

interface ProjectHeaderProps {
  /** Undefined while the project is loading; renders skeleton. */
  project: Project | undefined;
  showToolNavigation?: boolean;
  optionsOpen?: boolean;
  onToggleOptions?: () => void;
  onEditProject?: () => void;
  onProjectImages?: () => void;
  onDeleteProject?: () => void;
}

export function ProjectHeader({
  project,
  showToolNavigation = true,
  optionsOpen = false,
  onToggleOptions,
  onEditProject,
  onProjectImages,
  onDeleteProject,
}: ProjectHeaderProps) {
  if (!project) return <SkeletonBar />;

  return (
    <header className="no-print relative z-10 overflow-visible bg-brand-500 px-4 py-3 md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link
            to="/projects"
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-white/65 transition-colors hover:text-white"
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
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
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
                buttonClassName="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              />
            )}
            <Link
              to={`/projects/${project.id}`}
              className="truncate text-xl font-semibold leading-tight text-white hover:underline"
            >
              {project.name}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showToolNavigation && (
            <nav aria-label="Project tools" className="flex gap-2 overflow-x-auto">
              {(
                [
                  [`/projects/${project.id}/snapshot`, 'Snapshot'],
                  [`/projects/${project.id}/ffe/table`, 'FF&E'],
                  [`/projects/${project.id}/proposal/table`, 'Proposal'],
                  [`/projects/${project.id}/plans`, 'Plans'],
                ] as const
              ).map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    [
                      'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition',
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
          )}
        </div>
      </div>
    </header>
  );
}
