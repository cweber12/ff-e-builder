import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import { SegmentedControl } from '../../primitives';
import { SidebarDivider } from './SidebarDivider';
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
  const navigate = useNavigate();

  const sidebarSections: Array<{
    key: string;
    label?: string;
    content: ReactNode;
    sectionClassName?: string;
  }> = [];

  const viewAndFiltersBlocks: ReactNode[] = [];

  if (showViewToggle) {
    const currentView = isCatalogRoute ? 'catalog' : 'list';
    viewAndFiltersBlocks.push(
      <SidebarFieldGroup key="view-toggle" className="space-y-2">
        <SidebarSectionHeader label="View" />
        <SegmentedControl
          value={currentView}
          onChange={(value) => {
            navigate(`/projects/${projectId}/ffe/${value}`);
          }}
          ariaLabel="FF&E view mode"
          variant="toolbar"
          className="w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-start"
        >
          <SegmentedControl.Option value="catalog">Catalog</SegmentedControl.Option>
          <SegmentedControl.Option value="list">List</SegmentedControl.Option>
        </SegmentedControl>
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
