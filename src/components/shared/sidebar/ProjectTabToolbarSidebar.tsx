import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SidebarButton } from './SidebarButton';
import { SidebarButtonGroup } from './SidebarButtonGroup';

interface ProjectTabToolbarSidebarProps {
  projectId: string;
  showViewToggle: boolean;
  isCatalogRoute: boolean;
  header?: ReactNode;
  toolbarLeft: ReactNode;
  toolbarCenter: ReactNode;
  actions: ReactNode;
  filtersLabel?: string;
  actionsLabel?: string;
}

export function ProjectTabToolbarSidebar({
  projectId,
  showViewToggle,
  isCatalogRoute,
  header,
  toolbarLeft,
  toolbarCenter,
  actions,
  filtersLabel,
  actionsLabel,
}: ProjectTabToolbarSidebarProps) {
  if (!showViewToggle && !header && !toolbarLeft && !toolbarCenter && !actions) return null;

  const sidebarSections: Array<{ key: string; label?: string; content: ReactNode }> = [];

  if (showViewToggle) {
    sidebarSections.push({
      key: 'view',
      label: 'View',
      content: (
        <SidebarButtonGroup role="radiogroup" aria-label="FF&E view mode">
          <SidebarButton asChild selected={isCatalogRoute}>
            <Link
              to={`/projects/${projectId}/ffe/catalog`}
              data-active={isCatalogRoute || undefined}
            >
              Catalog
            </Link>
          </SidebarButton>
          <SidebarButton asChild selected={!isCatalogRoute}>
            <Link
              to={`/projects/${projectId}/ffe/table`}
              data-active={!isCatalogRoute || undefined}
            >
              Table
            </Link>
          </SidebarButton>
        </SidebarButtonGroup>
      ),
    });
  }

  if (toolbarLeft) {
    sidebarSections.push({
      key: 'contextual-filters',
      label: filtersLabel ?? 'Filters',
      content: <div className="project-sidebar-slot">{toolbarLeft}</div>,
    });
  }

  if (toolbarCenter) {
    sidebarSections.push({
      key: 'contextual-tools',
      label: 'Tools',
      content: <div className="project-sidebar-slot">{toolbarCenter}</div>,
    });
  }

  if (actions) {
    sidebarSections.push({
      key: 'actions',
      label: actionsLabel ?? 'Actions',
      content: <SidebarButtonGroup>{actions}</SidebarButtonGroup>,
    });
  }

  return (
    <aside className="no-print w-full shrink-0 border-b border-neutral-200 bg-canvas-shell/70 lg:w-60 lg:border-b-0 lg:border-r lg:border-r-neutral-200">
      <div className="space-y-3 overflow-x-hidden p-3 md:p-4">
        {header ? <div className="project-sidebar-section min-w-0">{header}</div> : null}
        {sidebarSections.map((section) => (
          <section key={section.key} className="project-sidebar-section">
            {section.label ? <p className="project-sidebar-title">{section.label}</p> : null}
            <div className="min-w-0 pt-0.5">{section.content}</div>
          </section>
        ))}
      </div>
    </aside>
  );
}
