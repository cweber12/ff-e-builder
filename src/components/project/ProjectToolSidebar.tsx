import type { Project } from '../../types';
import { ProjectToolNav } from './ProjectToolNav';

interface ProjectToolSidebarProps {
  project: Project;
}

export function ProjectToolSidebar({ project }: ProjectToolSidebarProps) {
  return (
    <aside
      aria-label="Project navigation"
      className="project-tool-sidebar no-print hidden shrink-0 border-r border-neutral-200 bg-white lg:sticky lg:top-11 lg:block lg:h-[calc(100vh-44px)] lg:w-[152px] lg:self-start"
    >
      <div className="project-tool-sidebar-shell">
        <ProjectToolNav projectId={project.id} orientation="vertical" />
      </div>
    </aside>
  );
}
