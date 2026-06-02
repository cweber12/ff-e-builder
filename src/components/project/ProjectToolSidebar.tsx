import type { ReactNode } from 'react';
import type { Project } from '../../types';
import { ProjectToolNav } from './ProjectToolNav';

interface ProjectToolSidebarProps {
  project: Project;
  /**
   * Options menu trigger for the active tool, rendered to the right of the
   * active tab.
   */
  optionsMenu?: ReactNode;
  /**
   * Contextual controls for the active tool, rendered below the tab list and
   * separated by a hairline divider. When omitted, only the tabs are shown.
   */
  section?: ReactNode;
}

export function ProjectToolSidebar({ project, optionsMenu, section }: ProjectToolSidebarProps) {
  return (
    <aside
      aria-label="Project navigation"
      className="project-tool-sidebar no-print hidden shrink-0 border-r border-neutral-200 bg-white lg:sticky lg:top-11 lg:block lg:h-[calc(100vh-44px)] lg:w-[208px] lg:self-start"
    >
      <div className="project-tool-sidebar-shell">
        <ProjectToolNav
          projectId={project.id}
          orientation="vertical"
          activeToolOptions={optionsMenu}
        />
        {section ? (
          <>
            <div className="project-tool-sidebar-divider" aria-hidden="true" />
            <div className="project-tool-sidebar-section">{section}</div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
