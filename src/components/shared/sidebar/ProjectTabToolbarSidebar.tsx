import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { SidebarDivider } from './SidebarDivider';
import { SidebarFieldGroup } from './SidebarFieldGroup';

interface ProjectTabToolbarSidebarProps {
  sidebarTitle: string;
  collapsed?: boolean;
  onTogglePanel?: (() => void) | null;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  header?: ReactNode;
  toolbarLeft?: ReactNode;
  toolbarCenter?: ReactNode;
  actions?: ReactNode;
}

export function ProjectTabToolbarSidebar({
  sidebarTitle,
  collapsed = false,
  onTogglePanel = null,
  headerLeft,
  headerRight,
  header,
  toolbarLeft,
  toolbarCenter,
  actions,
}: ProjectTabToolbarSidebarProps) {
  const sidebarSections = [
    header ? { key: 'context', content: <SidebarFieldGroup>{header}</SidebarFieldGroup> } : null,
    toolbarLeft
      ? { key: 'toolbar-left', content: <SidebarFieldGroup>{toolbarLeft}</SidebarFieldGroup> }
      : null,
    toolbarCenter
      ? { key: 'toolbar-center', content: <SidebarFieldGroup>{toolbarCenter}</SidebarFieldGroup> }
      : null,
    actions ? { key: 'actions', content: <SidebarFieldGroup>{actions}</SidebarFieldGroup> } : null,
  ].filter(Boolean) as Array<{ key: string; content: ReactNode }>;

  if (collapsed) {
    return (
      <aside
        id="project-tab-toolbar-sidebar"
        aria-label="Project tab sidebar"
        className="project-tab-toolbar-sidebar project-tab-toolbar-sidebar--collapsed no-print w-full shrink-0 border-b lg:sticky lg:top-[88px] lg:h-[calc(100vh-88px)] lg:w-14 lg:self-start lg:border-b-0 lg:border-r"
      >
        <div className="project-sidebar-rail project-sidebar-rail--collapsed h-full">
          <span className="project-sidebar-rail-label" aria-hidden="true">
            {sidebarTitle}
          </span>
          {onTogglePanel ? (
            <button
              type="button"
              className="project-sidebar-rail-toggle icon-btn text-neutral-500 hover:text-neutral-950"
              aria-label="Open project sidebar"
              aria-controls="project-tab-toolbar-sidebar"
              aria-expanded="false"
              title="Open project sidebar"
              onClick={onTogglePanel}
            >
              <ChevronRight className="toolbar-icon" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </aside>
    );
  }

  if (!headerLeft && !headerRight && !header && !toolbarLeft && !toolbarCenter && !actions) {
    return null;
  }

  return (
    <aside
      id="project-tab-toolbar-sidebar"
      aria-label="Project tab sidebar"
      className="project-tab-toolbar-sidebar no-print w-full shrink-0 border-b lg:sticky lg:top-[88px] lg:h-[calc(100vh-88px)] lg:w-60 lg:self-start lg:border-b-0 lg:border-r"
    >
      <div className="project-sidebar-shell lg:h-full">
        <div className="project-sidebar-header">
          <div className="project-sidebar-header-side">
            {headerLeft ?? <span aria-hidden="true" />}
          </div>
          <p className="project-sidebar-header-title">{sidebarTitle}</p>
          <div className="project-sidebar-header-side project-sidebar-header-side--right">
            {headerRight ?? <span aria-hidden="true" />}
          </div>
        </div>
        <div className="project-sidebar-content flex flex-col gap-3 overflow-x-hidden p-3 lg:h-full">
          {sidebarSections.map((section, index) => (
            <Fragment key={section.key}>
              <section className={cn('project-sidebar-section')}>
                <div className="min-w-0">{section.content}</div>
              </section>
              {index < sidebarSections.length - 1 ? <SidebarDivider /> : null}
            </Fragment>
          ))}
        </div>
      </div>
    </aside>
  );
}
