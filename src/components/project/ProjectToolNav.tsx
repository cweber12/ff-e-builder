import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

type ProjectToolTab = {
  label: string;
  href: (id: string) => string;
  isActive: (id: string, pathname: string) => boolean;
};

const PROJECT_TOOL_TABS: ProjectToolTab[] = [
  {
    label: 'FF&E',
    href: (id: string) => `/projects/${id}/ffe/catalog`,
    isActive: (id: string, pathname: string) => pathname.includes(`/projects/${id}/ffe`),
  },
  {
    label: 'Item Library',
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

interface ProjectToolNavProps {
  projectId: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  /**
   * Options menu trigger for the active tool, rendered to the right of the
   * active tab. Only honored in the vertical (rail) orientation.
   */
  activeToolOptions?: ReactNode;
}

export function ProjectToolNav({
  projectId,
  orientation = 'horizontal',
  className,
  activeToolOptions,
}: ProjectToolNavProps) {
  const location = useLocation();
  const isVertical = orientation === 'vertical';

  return (
    <nav
      aria-label="Project tools"
      className={cn(isVertical ? 'project-tool-sidebar-nav' : 'flex items-stretch', className)}
    >
      {PROJECT_TOOL_TABS.map(({ label, href, isActive }) => {
        const selected = isActive(projectId, location.pathname);
        const link = (
          <Link
            key={label}
            to={href(projectId)}
            aria-current={selected ? 'page' : undefined}
            data-active={selected || undefined}
            className={
              isVertical
                ? 'project-tool-sidebar-link'
                : 'inline-flex h-11 items-center px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:text-neutral-900 data-[active]:font-bold data-[active]:text-neutral-950'
            }
          >
            {label}
          </Link>
        );

        if (isVertical && selected && activeToolOptions) {
          return (
            <div key={label} className="project-tool-sidebar-row" data-active>
              {link}
              {activeToolOptions}
            </div>
          );
        }

        return link;
      })}
    </nav>
  );
}
