import { Link, NavLink } from 'react-router-dom';
import type { Project } from '../../types';

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
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  if (!project) return <SkeletonBar />;

  const metadata = [
    project.clientName,
    project.companyName ? `Company: ${project.companyName}` : '',
    project.projectLocation ? `Location: ${project.projectLocation}` : '',
  ].filter(Boolean);

  return (
    <header className="no-print relative z-20 overflow-visible bg-brand-500 px-4 py-3 md:px-6">
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
            All projects
          </Link>
          <h2 className="truncate text-xl font-semibold leading-tight text-white">
            {project.name}
          </h2>
          {metadata.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/65">
              {metadata.map((entry) => (
                <span key={entry}>{entry}</span>
              ))}
            </p>
          )}
        </div>

        <nav aria-label="Project tools" className="flex gap-2 overflow-x-auto">
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
      </div>
    </header>
  );
}
