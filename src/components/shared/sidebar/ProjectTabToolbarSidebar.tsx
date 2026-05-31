import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';
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
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [viewMenuOpen]);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewMenuOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [viewMenuOpen]);

  useEffect(() => {
    setViewMenuOpen(false);
  }, [isCatalogRoute]);

  if (!showViewToggle && !header && !toolbarLeft && !toolbarCenter && !actions) return null;

  const sidebarSections: Array<{ key: string; label?: string; content: ReactNode }> = [];

  if (showViewToggle) {
    const currentView = isCatalogRoute ? 'Catalog' : 'List';
    sidebarSections.push({
      key: 'view',
      content: (
        <div className="space-y-2">
          <div ref={viewMenuRef} className="relative">
            <button
              type="button"
              className="sidebar-view-toggle"
              aria-haspopup="menu"
              aria-expanded={viewMenuOpen}
              onClick={() => setViewMenuOpen((open) => !open)}
            >
              <span className="sidebar-view-toggle-label">View</span>
              <span className="sidebar-view-toggle-value">{currentView}</span>
              <ChevronDown
                className={cn('sidebar-view-toggle-icon', viewMenuOpen && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            {viewMenuOpen ? (
              <div role="menu" aria-label="FF&E view mode" className="sidebar-view-menu menu-panel">
                <SidebarButton asChild selected={isCatalogRoute} role="menuitem">
                  <Link
                    to={`/projects/${projectId}/ffe/catalog`}
                    data-active={isCatalogRoute || undefined}
                    onClick={() => setViewMenuOpen(false)}
                  >
                    Catalog
                  </Link>
                </SidebarButton>
                <SidebarButton asChild selected={!isCatalogRoute} role="menuitem">
                  <Link
                    to={`/projects/${projectId}/ffe/list`}
                    data-active={!isCatalogRoute || undefined}
                    onClick={() => setViewMenuOpen(false)}
                  >
                    List
                  </Link>
                </SidebarButton>
              </div>
            ) : null}
          </div>
          {toolbarCenter ? <div className="project-sidebar-slot">{toolbarCenter}</div> : null}
        </div>
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

  if (toolbarCenter && !showViewToggle) {
    sidebarSections.push({
      key: 'contextual-tools',
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
    <aside className="project-tab-toolbar-sidebar no-print w-full shrink-0 border-b border-neutral-200 bg-canvas-shell/70 lg:w-60 lg:border-b-0 lg:border-r lg:border-r-neutral-200">
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
