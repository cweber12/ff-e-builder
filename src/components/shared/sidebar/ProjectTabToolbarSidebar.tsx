import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import { SidebarButton } from './SidebarButton';
import { SidebarButtonGroup } from './SidebarButtonGroup';

interface ProjectTabToolbarSidebarProps {
  projectId: string;
  showViewToggle: boolean;
  isCatalogRoute: boolean;
  collapsed?: boolean;
  onTogglePanel?: (() => void) | null;
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
  collapsed = false,
  onTogglePanel = null,
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

  const sidebarSections: Array<{
    key: string;
    label: string;
    shortLabel: string;
    content: ReactNode;
    className?: string;
  }> = [];

  if (showViewToggle) {
    const currentView = isCatalogRoute ? 'Catalog' : 'List';
    sidebarSections.push({
      key: 'view',
      label: 'View',
      shortLabel: currentView === 'Catalog' ? 'CAT' : 'LIST',
      className: 'project-sidebar-section--quiet project-sidebar-section--wide',
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

  if (header) {
    sidebarSections.push({
      key: 'summary',
      label: 'Context',
      shortLabel: 'CTX',
      className: 'project-sidebar-section--quiet',
      content: <div className="project-sidebar-slot">{header}</div>,
    });
  }

  if (toolbarLeft) {
    sidebarSections.push({
      key: 'contextual-filters',
      label: filtersLabel ?? 'Filters',
      shortLabel: 'FIL',
      className: 'project-sidebar-section--quiet',
      content: <div className="project-sidebar-slot">{toolbarLeft}</div>,
    });
  }

  if (toolbarCenter && !showViewToggle) {
    sidebarSections.push({
      key: 'contextual-tools',
      label: 'Tools',
      shortLabel: 'TLS',
      className: 'project-sidebar-section--quiet',
      content: <div className="project-sidebar-slot">{toolbarCenter}</div>,
    });
  }

  if (actions) {
    sidebarSections.push({
      key: 'actions',
      label: actionsLabel ?? 'Actions',
      shortLabel: 'ACT',
      className: 'project-sidebar-section--actions project-sidebar-section--wide',
      content: <SidebarButtonGroup>{actions}</SidebarButtonGroup>,
    });
  }

  if (collapsed) {
    return (
      <aside
        id="project-tab-toolbar-sidebar"
        aria-label="Project tab sidebar"
        className="project-tab-toolbar-sidebar project-tab-toolbar-sidebar--collapsed no-print w-full shrink-0 border-b border-neutral-200 bg-canvas-shell/80 lg:sticky lg:top-[88px] lg:h-[calc(100vh-88px)] lg:w-14 lg:self-start lg:border-b-0 lg:border-r lg:border-r-neutral-200"
      >
        <div className="project-sidebar-rail h-full">
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
              <ChevronLeft className="toolbar-icon" aria-hidden="true" />
            </button>
          ) : null}
          <div className="project-sidebar-rail-stack" aria-label="Sidebar sections">
            {sidebarSections.map((section, index) => (
              <div
                key={section.key}
                className={cn(
                  'project-sidebar-rail-item',
                  index === 0 && 'project-sidebar-rail-item--active',
                )}
                title={section.label}
                aria-label={section.label}
              >
                <span className="project-sidebar-rail-item-short">{section.shortLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  if (!showViewToggle && !header && !toolbarLeft && !toolbarCenter && !actions) return null;

  return (
    <aside
      id="project-tab-toolbar-sidebar"
      aria-label="Project tab sidebar"
      className="project-tab-toolbar-sidebar no-print w-full shrink-0 border-b border-neutral-200 bg-canvas-shell/70 lg:sticky lg:top-[88px] lg:h-[calc(100vh-88px)] lg:w-60 lg:self-start lg:border-b-0 lg:border-r lg:border-r-neutral-200"
    >
      <div className="grid gap-3 overflow-x-hidden p-3 md:grid-cols-2 md:items-start lg:h-full lg:grid-cols-1 lg:p-4">
        {onTogglePanel ? (
          <button
            type="button"
            className="project-sidebar-rail-toggle icon-btn text-neutral-500 hover:text-neutral-950 md:col-span-2 lg:col-span-1"
            aria-label="Collapse project sidebar"
            aria-controls="project-tab-toolbar-sidebar"
            aria-expanded="true"
            title="Collapse project sidebar"
            onClick={onTogglePanel}
          >
            <ChevronLeft className="toolbar-icon" aria-hidden="true" />
          </button>
        ) : null}
        {sidebarSections.map((section) => (
          <section key={section.key} className={cn('project-sidebar-section', section.className)}>
            <p className="project-sidebar-title">{section.label}</p>
            <div className="min-w-0 pt-0.5">{section.content}</div>
          </section>
        ))}
      </div>
    </aside>
  );
}
