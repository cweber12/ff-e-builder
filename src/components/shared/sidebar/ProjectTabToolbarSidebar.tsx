import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import { SidebarDivider } from './SidebarDivider';
import { SidebarButton } from './SidebarButton';
import { SidebarButtonGroup } from './SidebarButtonGroup';
import { SidebarFieldGroup } from './SidebarFieldGroup';
import { SidebarSectionHeader } from './SidebarSectionHeader';

interface ProjectTabToolbarSidebarProps {
  projectId: string;
  sidebarTitle: string;
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
  sidebarTitle,
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
    label?: string;
    content: ReactNode;
    sectionClassName?: string;
  }> = [];

  const viewAndFiltersBlocks: ReactNode[] = [];

  if (showViewToggle) {
    const currentView = isCatalogRoute ? 'Catalog' : 'List';
    viewAndFiltersBlocks.push(
      <SidebarFieldGroup key="view-toggle" className="space-y-2">
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
      </SidebarFieldGroup>,
    );
    if (toolbarCenter) {
      viewAndFiltersBlocks.push(
        <SidebarFieldGroup key="view-toolbar-center">{toolbarCenter}</SidebarFieldGroup>,
      );
    }
  }

  if (header) {
    sidebarSections.push({
      key: 'context',
      content: <SidebarFieldGroup>{header}</SidebarFieldGroup>,
    });
  }

  if (toolbarLeft) {
    viewAndFiltersBlocks.push(
      <SidebarFieldGroup key="view-toolbar-left">{toolbarLeft}</SidebarFieldGroup>,
    );
  }

  if (toolbarCenter && !showViewToggle) {
    viewAndFiltersBlocks.push(
      <SidebarFieldGroup key="toolbar-center">{toolbarCenter}</SidebarFieldGroup>,
    );
  }

  if (viewAndFiltersBlocks.length > 0) {
    const sectionLabel = filtersLabel === '' ? undefined : (filtersLabel ?? 'View & Filters');
    sidebarSections.push({
      key: 'view-and-filters',
      ...(sectionLabel ? { label: sectionLabel } : {}),
      content: <SidebarFieldGroup>{viewAndFiltersBlocks}</SidebarFieldGroup>,
    });
  }

  if (actions) {
    const sectionLabel = actionsLabel === '' ? undefined : (actionsLabel ?? 'Actions');
    sidebarSections.push({
      key: 'actions',
      ...(sectionLabel ? { label: sectionLabel } : {}),
      sectionClassName: 'project-sidebar-section--actions',
      content: <SidebarButtonGroup>{actions}</SidebarButtonGroup>,
    });
  }

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

  if (!showViewToggle && !header && !toolbarLeft && !toolbarCenter && !actions) return null;

  return (
    <aside
      id="project-tab-toolbar-sidebar"
      aria-label="Project tab sidebar"
      className="project-tab-toolbar-sidebar no-print w-full shrink-0 border-b lg:sticky lg:top-[88px] lg:h-[calc(100vh-88px)] lg:w-60 lg:self-start lg:border-b-0 lg:border-r"
    >
      <div className="project-sidebar-shell lg:h-full">
        <div className="project-sidebar-header">
          <p className="project-sidebar-header-title">{sidebarTitle}</p>
        </div>
        <div className="project-sidebar-content flex flex-col gap-3 overflow-x-hidden p-3 lg:h-full">
          {sidebarSections.map((section, index) => (
            <Fragment key={section.key}>
              <section
                className={cn(
                  'project-sidebar-section',
                  section.sectionClassName,
                  !section.label && 'project-sidebar-section--context',
                )}
              >
                {section.label ? <SidebarSectionHeader label={section.label} /> : null}
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
