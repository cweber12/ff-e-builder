import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGate, SignInPage, UserMenu } from './components/shared/auth/AuthGate';
import {
  CatalogView,
  CATALOG_ACTIONS_SLOT_ID,
  CATALOG_NAVIGATOR_PANEL_SLOT_ID,
  CATALOG_OPTIONS_SLOT_ID,
  CATALOG_PICKER_SLOT_ID,
} from './components/ffe/catalog/CatalogView';
import { FfeItemList } from './components/ffe/list';
import {
  MATERIALS_ACTIONS_SLOT_ID,
  MATERIALS_FILTER_SLOT_ID,
  MATERIALS_FINISHES_PANEL_SLOT_ID,
  MATERIALS_HEADER_VIEW_SLOT_ID,
  MATERIALS_OPTIONS_SLOT_ID,
  MaterialsView,
} from './components/materials/MaterialsView';
import { BudgetView } from './components/project/BudgetView';
import { FfeBudgetModal } from './components/project/modals/FfeBudgetModal';
import { ProposalBudgetModal } from './components/project/modals/ProposalBudgetModal';
import { ImportProposalExcelModal } from './components/proposal/import/ImportProposalExcelModal';
import { ProjectHeader } from './components/project/ProjectHeader';
import { ProjectToolSidebar } from './components/project/ProjectToolSidebar';
import { ProposalTable } from './components/proposal/table/ProposalTable';
import { ProposalSidebarSections } from './components/project/AppBarActions';
import { Button, MenuItem, MenuSeparator, MenuSub, MenuSubTrigger } from './components/primitives';
import {
  SidebarButton,
  SidebarButtonGroup,
  SidebarHeaderMenu,
  SidebarHeaderSelect,
} from './components/shared/sidebar';
import { recordSession } from './lib/utils';
import {
  exportSummaryCsv,
  exportSummaryExcel,
  exportSummaryPdf,
  exportProposalCsv,
  exportProposalExcel,
  exportProposalPdf,
} from './lib/export';
import {
  readColumnConfigFromStorage,
  useColumnDefs,
  useAddProposalItemToFfe,
  useRemoveItemFromFfe,
  useProjects,
  useRoomsWithItems,
  useFfeCatalogGroups,
  useProposalWithItems,
} from './hooks';
import { DashboardPage } from './pages/DashboardPage';
import { CompanyProfilePage } from './pages/CompanyProfilePage';
import { PlanCanvasPage } from './pages/PlanCanvasPage';
import { ProjectOverviewPage } from './pages/ProjectOverviewPage';
import {
  PlansPage,
  PLANS_ACTIONS_SLOT_ID,
  PLANS_FILTER_SLOT_ID,
  PLANS_OPTIONS_SLOT_ID,
  PLANS_SUMMARY_SLOT_ID,
} from './pages/PlansPage';
import type { Project, RoomWithItems, ProposalCategoryWithItems } from './types';

type ProjectContext = {
  project: Project;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
  onProposalImport: () => void;
  /** Controlled Add Category modal state (lifted to ProjectLayout). */
  addCategoryOpen: boolean;
  onAddCategoryOpenChange: (open: boolean) => void;
  proposalRevisionMode: boolean;
  onProposalRevisionModeChange: (next: boolean) => void;
  proposalSpreadsheetRequest: { categoryId: string; filter: 'all' | 'flagged' } | null;
  onProposalSpreadsheetRequest: (
    request: { categoryId: string; filter: 'all' | 'flagged' } | null,
  ) => void;
};

function App() {
  useEffect(() => {
    recordSession();
  }, []);

  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route
        element={
          <AuthGate>
            <Outlet />
          </AuthGate>
        }
      >
        <Route path="/projects" element={<DashboardPage />} />
        <Route path="/company" element={<CompanyProfilePage />} />
        <Route path="/projects/:id" element={<ProjectLayout />}>
          <Route index element={<ProjectOverviewRoute />} />
          <Route path="snapshot" element={<Navigate to=".." replace />} />
          <Route path="ffe" element={<ProjectToolRedirect tool="ffe" />} />
          <Route path="ffe/table" element={<ProjectRedirectTo target="ffe/list" />} />
          <Route path="ffe/list" element={<ProjectListRoute />} />
          <Route path="ffe/catalog" element={<ProjectCatalogRoute />} />
          <Route path="ffe/materials" element={<ProjectRedirectTo target="materials" />} />
          <Route path="ffe/summary" element={<ProjectRedirectTo target="budget" />} />
          <Route path="proposal" element={<ProjectToolRedirect tool="proposal" />} />
          <Route path="proposal/table" element={<ProjectProposalRoute />} />
          <Route path="proposal/materials" element={<ProjectRedirectTo target="materials" />} />
          <Route path="proposal/summary" element={<ProjectRedirectTo target="budget" />} />
          <Route path="plans" element={<ProjectPlansRoute />} />
          <Route path="plans/:planId" element={<ProjectPlanCanvasRoute />} />
          <Route path="materials" element={<ProjectMaterialsRoute />} />
          <Route path="budget" element={<ProjectBudgetRoute />} />
          <Route path="table" element={<Navigate to="ffe/list" replace />} />
          <Route path="catalog" element={<Navigate to="ffe/catalog" replace />} />
          <Route path="summary" element={<Navigate to="budget" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ProjectLayout() {
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const project = projects?.find((p) => p.id === id);
  const { roomsWithItems, isLoading: dataLoading } = useRoomsWithItems(id ?? '');
  const { categoriesWithItems: proposalCategoriesWithItems, isLoading: proposalLoading } =
    useProposalWithItems(id ?? '', new Set());
  const [proposalImportOpen, setProposalImportOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [proposalRevisionMode, setProposalRevisionMode] = useState(false);
  const [proposalSpreadsheetRequest, setProposalSpreadsheetRequest] = useState<{
    categoryId: string;
    filter: 'all' | 'flagged';
  } | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(min-width: 1024px)').matches,
  );

  // Track the lg breakpoint so the tool controls mount in exactly one place:
  // the left rail on desktop, or the mobile drop panel below the header.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Collapse the mobile tool panel when navigating between tools.
  useEffect(() => {
    setMobilePanelOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setProposalRevisionMode(false);
    setProposalSpreadsheetRequest(null);
  }, [id]);

  const isPlanCanvasRoute = /^\/projects\/[^/]+\/plans\/[^/]+$/.test(location.pathname);
  const isFfeRoute = !!id && location.pathname.includes(`/projects/${id}/ffe`);
  const isProposalRoute = !!id && location.pathname.includes(`/projects/${id}/proposal`);
  const isPlansRoute = !!id && location.pathname.includes(`/projects/${id}/plans`);
  const isMaterialsRoute = !!id && location.pathname.includes(`/projects/${id}/materials`);
  const isCatalogRoute = location.pathname.includes('/ffe/catalog');
  const isTableRoute = isProposalRoute;
  const isBudgetRoute = !!id && location.pathname.endsWith('/budget');

  // Projects loaded but this ID doesn't exist → 404
  if (!projectsLoading && projects !== undefined && !project) return <NotFound />;

  const isLoading = projectsLoading || dataLoading || proposalLoading;

  const sidebarActions =
    !isLoading && project ? (
      isFfeRoute ? (
        isCatalogRoute ? (
          <div id={CATALOG_ACTIONS_SLOT_ID} className="project-sidebar-slot" />
        ) : null
      ) : isBudgetRoute ? (
        <BudgetPageActions
          project={project}
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
          layout="column"
        />
      ) : isMaterialsRoute ? (
        <div id={MATERIALS_ACTIONS_SLOT_ID} className="project-sidebar-slot" />
      ) : isPlansRoute ? (
        <div id={PLANS_ACTIONS_SLOT_ID} className="project-sidebar-slot" />
      ) : null
    ) : null;

  const sidebarToolbarCenter =
    !isLoading && isCatalogRoute ? (
      <div
        id={CATALOG_PICKER_SLOT_ID}
        className="project-sidebar-slot project-sidebar-slot--stretch"
      />
    ) : null;

  const sidebarToolbarLeft =
    !isLoading && isPlansRoute ? (
      <div id={PLANS_FILTER_SLOT_ID} className="project-sidebar-slot" />
    ) : !isLoading && isMaterialsRoute ? (
      <div id={MATERIALS_FILTER_SLOT_ID} className="project-sidebar-slot" />
    ) : null;

  const sidebarHeader =
    !isLoading && project ? (
      isProposalRoute ? null : isPlansRoute ? (
        <div id={PLANS_SUMMARY_SLOT_ID} className="min-w-0" />
      ) : null
    ) : null;

  const proposalSidebarSection =
    !isLoading && project && isProposalRoute ? (
      <ProposalSidebarSections
        project={project}
        categoriesWithItems={proposalCategoriesWithItems}
        revisionMode={proposalRevisionMode}
        onRevisionModeChange={setProposalRevisionMode}
        onOpenSpreadsheetRequest={setProposalSpreadsheetRequest}
        onAddCategory={() => setAddCategoryOpen(true)}
        onImport={() => setProposalImportOpen(true)}
      />
    ) : null;

  const sidebarHeaderLeft =
    !isLoading && project ? (
      isCatalogRoute ? (
        <div id={CATALOG_OPTIONS_SLOT_ID} className="project-sidebar-header-inline-slot" />
      ) : isProposalRoute ? null : isBudgetRoute ? (
        <BudgetOptionsMenu
          project={project}
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
        />
      ) : isMaterialsRoute ? (
        <div id={MATERIALS_OPTIONS_SLOT_ID} className="project-sidebar-header-inline-slot" />
      ) : isPlansRoute ? (
        <div id={PLANS_OPTIONS_SLOT_ID} className="project-sidebar-header-inline-slot" />
      ) : null
    ) : null;

  const sidebarHeaderRight =
    !isLoading && project ? (
      isFfeRoute && !isCatalogRoute ? (
        <FfeSidebarViewSelect
          projectId={project.id}
          currentView={isCatalogRoute ? 'catalog' : 'list'}
        />
      ) : isMaterialsRoute ? (
        <div id={MATERIALS_HEADER_VIEW_SLOT_ID} className="project-sidebar-header-inline-slot" />
      ) : null
    ) : null;

  // Contextual controls for the active tool, stacked below the rail tabs. Each
  // group reuses `.project-sidebar-section` so the relocated selects, inputs,
  // and segmented controls keep their established styling.
  const hasSection = Boolean(
    proposalSidebarSection ||
    sidebarHeaderRight ||
    sidebarHeader ||
    sidebarToolbarLeft ||
    sidebarToolbarCenter ||
    sidebarActions,
  );
  const sidebarSection = proposalSidebarSection ? (
    <div className="project-sidebar-section">{proposalSidebarSection}</div>
  ) : hasSection ? (
    <>
      {sidebarHeaderRight ? (
        <div className="project-sidebar-section">{sidebarHeaderRight}</div>
      ) : null}
      {sidebarHeader ? <div className="project-sidebar-section">{sidebarHeader}</div> : null}
      {sidebarToolbarLeft ? (
        <div className="project-sidebar-section">{sidebarToolbarLeft}</div>
      ) : null}
      {sidebarToolbarCenter ? (
        <div className="project-sidebar-section">{sidebarToolbarCenter}</div>
      ) : null}
      {sidebarActions ? <div className="project-sidebar-section">{sidebarActions}</div> : null}
    </>
  ) : null;

  const hasToolControls = Boolean(sidebarHeaderLeft) || hasSection;

  return (
    <main
      className={[
        'flex flex-col',
        isPlanCanvasRoute || isCatalogRoute ? 'h-screen overflow-hidden' : 'min-h-screen',
      ].join(' ')}
    >
      {isPlanCanvasRoute ? (
        // Fullscreen measurement workspace — no project chrome
        isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : project ? (
          <>
            <h1 className="sr-only">{project.name}</h1>
            <div className="min-h-0 flex-1 overflow-hidden">
              <Outlet
                context={
                  {
                    project,
                    roomsWithItems,
                    proposalCategoriesWithItems,
                    onProposalImport: () => setProposalImportOpen(true),
                    addCategoryOpen,
                    onAddCategoryOpenChange: setAddCategoryOpen,
                    proposalRevisionMode,
                    onProposalRevisionModeChange: setProposalRevisionMode,
                    proposalSpreadsheetRequest,
                    onProposalSpreadsheetRequest: setProposalSpreadsheetRequest,
                  } satisfies ProjectContext
                }
              />
            </div>
          </>
        ) : null
      ) : (
        <>
          <ProjectHeader
            project={project}
            userMenu={<UserMenu />}
            hasToolPanel={hasToolControls}
            toolPanelOpen={mobilePanelOpen}
            onToggleToolPanel={() => setMobilePanelOpen((open) => !open)}
          />
          {project && !isDesktop && hasToolControls ? (
            <div
              id="project-tool-panel"
              className={[
                'project-tool-panel no-print border-b border-neutral-200 bg-white lg:hidden',
                mobilePanelOpen ? '' : 'hidden',
              ].join(' ')}
            >
              <div className="project-tool-sidebar-section p-4">
                {sidebarHeaderLeft ? (
                  <div className="project-sidebar-section flex items-center gap-2">
                    <span className="toolbar-label">Options</span>
                    {sidebarHeaderLeft}
                  </div>
                ) : null}
                {sidebarSection}
              </div>
            </div>
          ) : null}
          <div className="flex flex-1 flex-col lg:flex-row">
            {project ? (
              <ProjectToolSidebar
                project={project}
                optionsMenu={isDesktop ? sidebarHeaderLeft : undefined}
                section={isDesktop ? sidebarSection : undefined}
              />
            ) : null}
            {project && isDesktop && isCatalogRoute ? (
              <div id={CATALOG_NAVIGATOR_PANEL_SLOT_ID} />
            ) : null}
            {project && isDesktop && isMaterialsRoute ? (
              <div id={MATERIALS_FINISHES_PANEL_SLOT_ID} />
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 min-w-0 flex-1">
                {isLoading ? (
                  <div className="flex justify-center py-24">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                  </div>
                ) : project ? (
                  <>
                    <h1 className="sr-only">{project.name}</h1>
                    {isTableRoute || isCatalogRoute ? (
                      // Full-width flush layout for table and catalog routes
                      <div className="flex flex-1 flex-col">
                        <Outlet
                          context={
                            {
                              project,
                              roomsWithItems,
                              proposalCategoriesWithItems,
                              onProposalImport: () => setProposalImportOpen(true),
                              addCategoryOpen,
                              onAddCategoryOpenChange: setAddCategoryOpen,
                              proposalRevisionMode,
                              onProposalRevisionModeChange: setProposalRevisionMode,
                              proposalSpreadsheetRequest,
                              onProposalSpreadsheetRequest: setProposalSpreadsheetRequest,
                            } satisfies ProjectContext
                          }
                        />
                      </div>
                    ) : (
                      // Padded layout for other routes (Budget, Materials, Plans, Overview)
                      <section className="project-content mx-auto max-w-7xl flex-1 px-4 py-6 md:px-6">
                        <Outlet
                          context={
                            {
                              project,
                              roomsWithItems,
                              proposalCategoriesWithItems,
                              onProposalImport: () => setProposalImportOpen(true),
                              addCategoryOpen,
                              onAddCategoryOpenChange: setAddCategoryOpen,
                              proposalRevisionMode,
                              onProposalRevisionModeChange: setProposalRevisionMode,
                              proposalSpreadsheetRequest,
                              onProposalSpreadsheetRequest: setProposalSpreadsheetRequest,
                            } satisfies ProjectContext
                          }
                        />
                      </section>
                    )}
                    {project && (
                      <>
                        <ImportProposalExcelModal
                          open={proposalImportOpen}
                          projectId={project.id}
                          categories={proposalCategoriesWithItems}
                          onClose={() => setProposalImportOpen(false)}
                          onSuccess={() => {
                            void queryClient.invalidateQueries();
                          }}
                        />
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function BudgetPageActions({
  project,
  roomsWithItems,
  proposalCategoriesWithItems,
  layout = 'row',
}: {
  project: Project;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
  layout?: 'row' | 'column';
}) {
  const isColumn = layout === 'column';
  const [ffeOpen, setFfeOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);

  return (
    <div className={isColumn ? 'project-sidebar-slot gap-2' : 'flex items-center gap-2'}>
      <SidebarButtonGroup className={isColumn ? undefined : 'md:flex-row md:items-center'}>
        {isColumn ? (
          <SidebarButton type="button" onClick={() => setFfeOpen(true)}>
            FF&amp;E Budget
          </SidebarButton>
        ) : (
          <Button type="button" variant="toolbar" onClick={() => setFfeOpen(true)}>
            FF&amp;E Budget
          </Button>
        )}
        {isColumn ? (
          <SidebarButton type="button" onClick={() => setProposalOpen(true)}>
            Proposal Budget
          </SidebarButton>
        ) : (
          <Button type="button" variant="toolbar" onClick={() => setProposalOpen(true)}>
            Proposal Budget
          </Button>
        )}
      </SidebarButtonGroup>
      <FfeBudgetModal
        open={ffeOpen}
        onClose={() => setFfeOpen(false)}
        project={project}
        roomsWithItems={roomsWithItems}
      />
      <ProposalBudgetModal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        project={project}
        categories={proposalCategoriesWithItems}
      />
    </div>
  );
}

export function BudgetOptionsMenu({
  project,
  roomsWithItems,
  proposalCategoriesWithItems,
}: {
  project: Project;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
}) {
  const [ffeOpen, setFfeOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const { data: proposalCustomColumnDefs = [] } = useColumnDefs(project.id, 'proposal');
  const proposalColumnOrder = () => readColumnConfigFromStorage(project.id, 'proposal')?.order;

  return (
    <>
      <SidebarHeaderMenu ariaLabel="Budget options">
        {({
          closeMenu,
          submenuOpen,
          toggleSubmenu,
          closeSubmenu,
          submenuTriggerRef,
          submenuPanelRef,
          getSubmenuPosition,
        }) => (
          <>
            <MenuItem
              onClick={() => {
                closeMenu();
                setFfeOpen(true);
              }}
            >
              FF&amp;E Budget
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                setProposalOpen(true);
              }}
            >
              Proposal Budget
            </MenuItem>
            <MenuSeparator />
            <MenuSubTrigger
              ref={submenuTriggerRef}
              aria-expanded={submenuOpen}
              onClick={toggleSubmenu}
            >
              Download
            </MenuSubTrigger>
            <MenuSub
              open={submenuOpen}
              panelRef={submenuPanelRef}
              position={getSubmenuPosition({
                align: 'top',
                anchorEdge: 'right',
                panelEdge: 'left',
                offsetY: 0,
                offsetX: 4,
              })}
              className="z-[281] min-w-44"
            >
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  exportSummaryCsv(project, roomsWithItems);
                  exportProposalCsv(
                    project,
                    proposalCategoriesWithItems,
                    proposalCustomColumnDefs,
                    proposalColumnOrder(),
                  );
                }}
              >
                Download CSV
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  void exportSummaryExcel(project, roomsWithItems);
                  void exportProposalExcel(
                    project,
                    proposalCategoriesWithItems,
                    null,
                    proposalCustomColumnDefs,
                    undefined,
                    proposalColumnOrder(),
                  );
                }}
              >
                Download Excel
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  exportSummaryPdf(project, roomsWithItems);
                  void exportProposalPdf(
                    project,
                    proposalCategoriesWithItems,
                    null,
                    {},
                    proposalCustomColumnDefs,
                    proposalColumnOrder(),
                  );
                }}
              >
                Download PDF
              </MenuItem>
            </MenuSub>
          </>
        )}
      </SidebarHeaderMenu>
      <FfeBudgetModal
        open={ffeOpen}
        onClose={() => setFfeOpen(false)}
        project={project}
        roomsWithItems={roomsWithItems}
      />
      <ProposalBudgetModal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        project={project}
        categories={proposalCategoriesWithItems}
      />
    </>
  );
}

function FfeSidebarViewSelect({
  projectId,
  currentView,
}: {
  projectId: string;
  currentView: 'catalog' | 'list';
}) {
  const navigate = useNavigate();

  return (
    <SidebarHeaderSelect
      valueLabel={currentView === 'catalog' ? 'Catalog' : 'List'}
      ariaLabel="FF&E view mode"
      options={[
        {
          label: 'Catalog',
          active: currentView === 'catalog',
          onSelect: () => navigate(`/projects/${projectId}/ffe/catalog`),
        },
        {
          label: 'List',
          active: currentView === 'list',
          onSelect: () => navigate(`/projects/${projectId}/ffe/list`),
        },
      ]}
    />
  );
}

function ProjectRedirectTo({ target }: { target: string }) {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}/${target}`} replace />;
}

function ProjectListRoute() {
  const { project, proposalCategoriesWithItems } = useProjectContext();
  const { groups, isLoading } = useFfeCatalogGroups(project.id);
  const addProposalItemToFfe = useAddProposalItemToFfe(project.id);
  const removeItemFromFfe = useRemoveItemFromFfe(project.id);

  return (
    <FfeItemList
      projectId={project.id}
      groups={groups}
      proposalCategoriesWithItems={proposalCategoriesWithItems}
      onAddToFfeItems={async (proposalItemIds) => {
        await Promise.all(
          proposalItemIds.map((proposalItemId) => addProposalItemToFfe.mutateAsync(proposalItemId)),
        );
      }}
      onRemoveFromFfe={removeItemFromFfe.mutateAsync}
      isLoading={isLoading}
    />
  );
}

function ProjectOverviewRoute() {
  const { project } = useProjectContext();
  return <ProjectOverviewPage project={project} />;
}

function ProjectToolRedirect({ tool }: { tool: 'ffe' | 'proposal' }) {
  const { id } = useParams();
  const target = tool === 'ffe' ? 'ffe/catalog' : 'proposal/table';
  return <Navigate to={`/projects/${id}/${target}`} replace />;
}

function ProjectProposalRoute() {
  const {
    project,
    onProposalImport,
    addCategoryOpen,
    onAddCategoryOpenChange,
    proposalRevisionMode,
    proposalSpreadsheetRequest,
    onProposalSpreadsheetRequest,
  } = useProjectContext();
  return (
    <ProposalTable
      projectId={project.id}
      project={project}
      onImport={onProposalImport}
      addCategoryOpen={addCategoryOpen}
      onAddCategoryOpenChange={onAddCategoryOpenChange}
      revisionMode={proposalRevisionMode}
      spreadsheetRequest={proposalSpreadsheetRequest}
      onSpreadsheetRequestHandled={() => onProposalSpreadsheetRequest(null)}
    />
  );
}

function ProjectCatalogRoute() {
  const { project, proposalCategoriesWithItems } = useProjectContext();
  const { groups } = useFfeCatalogGroups(project.id);
  const addProposalItemToFfe = useAddProposalItemToFfe(project.id);
  const removeItemFromFfe = useRemoveItemFromFfe(project.id);

  return (
    <CatalogView
      project={project}
      rooms={groups}
      proposalCategoriesWithItems={proposalCategoriesWithItems}
      onAddToFfeItems={async (proposalItemIds) => {
        await Promise.all(
          proposalItemIds.map((proposalItemId) => addProposalItemToFfe.mutateAsync(proposalItemId)),
        );
      }}
      onRemoveFromFfe={removeItemFromFfe.mutateAsync}
    />
  );
}

function ProjectMaterialsRoute() {
  const { project } = useProjectContext();
  return <MaterialsView project={project} />;
}

function ProjectBudgetRoute() {
  const { project, roomsWithItems, proposalCategoriesWithItems } = useProjectContext();
  return (
    <BudgetView
      project={project}
      roomsWithItems={roomsWithItems}
      proposalCategoriesWithItems={proposalCategoriesWithItems}
    />
  );
}

function ProjectPlansRoute() {
  const { project } = useProjectContext();
  return <PlansPage project={project} />;
}

function ProjectPlanCanvasRoute() {
  const { project, roomsWithItems, proposalCategoriesWithItems } = useProjectContext();
  const { planId = '' } = useParams();
  return (
    <PlanCanvasPage
      project={project}
      planId={planId}
      roomsWithItems={roomsWithItems}
      proposalCategoriesWithItems={proposalCategoriesWithItems}
    />
  );
}

function useProjectContext() {
  return useOutletContext<ProjectContext>();
}

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="border-y border-neutral-200 bg-canvas-chrome px-10 py-12 shadow-sm">
        <p className="num text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          404
        </p>
        <h1 className="mt-3 page-title text-2xl font-semibold text-neutral-950">Page not found</h1>
        <Link
          to="/projects"
          className="mt-6 inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}

export default App;
