import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGate, SignInPage, UserMenu } from './components/shared/auth/AuthGate';
import {
  CatalogView,
  CATALOG_ACTIONS_SLOT_ID,
  CATALOG_PICKER_SLOT_ID,
} from './components/ffe/catalog/CatalogView';
import { FfeItemList } from './components/ffe/list';
import {
  MATERIALS_ACTIONS_SLOT_ID,
  MATERIALS_FILTER_SLOT_ID,
  MaterialsView,
} from './components/materials/MaterialsView';
import { BudgetView } from './components/project/BudgetView';
import { FfeBudgetModal } from './components/project/modals/FfeBudgetModal';
import { ProposalBudgetModal } from './components/project/modals/ProposalBudgetModal';
import { ImportExcelModal } from './components/ffe/import/ImportExcelModal';
import { ImportProposalExcelModal } from './components/proposal/import/ImportProposalExcelModal';
import { ProjectHeader } from './components/project/ProjectHeader';
import { ExportMenu } from './components/shared/ExportMenu';
import { ProposalTable } from './components/proposal/table/ProposalTable';
import {
  FfeActions,
  ProposalActions,
  ProposalRevisionChip,
} from './components/project/AppBarActions';
import { Button } from './components/primitives';
import {
  ProjectTabToolbarSidebar,
  SidebarButton,
  SidebarButtonGroup,
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
  PLANS_SUMMARY_SLOT_ID,
} from './pages/PlansPage';
import type { Project, RoomWithItems, ProposalCategoryWithItems } from './types';

type ProjectContext = {
  project: Project;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
  onImport: () => void;
  onProposalImport: () => void;
  /** Controlled Add Room modal state (lifted to ProjectLayout). */
  addRoomOpen: boolean;
  onAddRoomOpenChange: (open: boolean) => void;
  /** Controlled Add Category modal state (lifted to ProjectLayout). */
  addCategoryOpen: boolean;
  onAddCategoryOpenChange: (open: boolean) => void;
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
  const [importOpen, setImportOpen] = useState(false);
  const [proposalImportOpen, setProposalImportOpen] = useState(false);
  // Lifted modal state for table routes
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);

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

  // Action cluster rendered in the app bar's right side
  const sidebarButtonGroup =
    !isLoading && project ? (
      isFfeRoute ? (
        isCatalogRoute ? (
          // CatalogView portals its own toolbar (Print / Export / Editor /
          // page counter) into this slot.
          <SidebarButtonGroup id={CATALOG_ACTIONS_SLOT_ID} />
        ) : (
          <FfeActions
            project={project}
            roomsWithItems={roomsWithItems}
            isCatalog={isCatalogRoute}
            onAddRoom={() => setAddRoomOpen(true)}
            onImport={() => setImportOpen(true)}
            layout="column"
          />
        )
      ) : isProposalRoute ? (
        <ProposalActions
          project={project}
          categoriesWithItems={proposalCategoriesWithItems}
          onAddCategory={() => setAddCategoryOpen(true)}
          onImport={() => setProposalImportOpen(true)}
          layout="column"
        />
      ) : isBudgetRoute ? (
        <BudgetPageActions
          project={project}
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
          layout="column"
        />
      ) : isMaterialsRoute ? (
        <SidebarButtonGroup id={MATERIALS_ACTIONS_SLOT_ID} />
      ) : isPlansRoute ? (
        <SidebarButtonGroup id={PLANS_ACTIONS_SLOT_ID} />
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
      <div
        id={PLANS_FILTER_SLOT_ID}
        className="toolbar-segmented project-sidebar-slot !flex !flex-col !items-start"
        role="tablist"
        aria-label="Filter plans"
      />
    ) : !isLoading && isMaterialsRoute ? (
      <div id={MATERIALS_FILTER_SLOT_ID} className="project-sidebar-slot" />
    ) : null;

  const sidebarHeader =
    !isLoading && project ? (
      isFfeRoute || isProposalRoute ? (
        <ProposalRevisionChip project={project} />
      ) : isPlansRoute ? (
        <div id={PLANS_SUMMARY_SLOT_ID} className="min-w-0" />
      ) : null
    ) : null;

  return (
    <main
      className={[
        'flex flex-col',
        isPlanCanvasRoute || isTableRoute ? 'h-screen overflow-hidden' : 'min-h-screen',
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
                    onImport: () => setImportOpen(true),
                    onProposalImport: () => setProposalImportOpen(true),
                    addRoomOpen,
                    onAddRoomOpenChange: setAddRoomOpen,
                    addCategoryOpen,
                    onAddCategoryOpenChange: setAddCategoryOpen,
                  } satisfies ProjectContext
                }
              />
            </div>
          </>
        ) : null
      ) : (
        <>
          <ProjectHeader project={project} userMenu={<UserMenu />} />
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {project ? (
              <ProjectTabToolbarSidebar
                projectId={project.id}
                showViewToggle={isFfeRoute}
                isCatalogRoute={isCatalogRoute}
                header={sidebarHeader}
                toolbarLeft={sidebarToolbarLeft}
                toolbarCenter={sidebarToolbarCenter}
                actions={sidebarButtonGroup}
                filtersLabel={isMaterialsRoute ? '' : 'Filters'}
                actionsLabel={isMaterialsRoute || isBudgetRoute ? '' : 'Actions'}
              />
            ) : null}
            <div className="min-h-0 min-w-0 flex-1">
              {isLoading ? (
                <div className="flex justify-center py-24">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                </div>
              ) : project ? (
                <>
                  <h1 className="sr-only">{project.name}</h1>
                  {isTableRoute ? (
                    // Full-width flush layout for FF&E and Proposal table routes
                    <div className="flex h-full flex-1 flex-col overflow-hidden">
                      <Outlet
                        context={
                          {
                            project,
                            roomsWithItems,
                            proposalCategoriesWithItems,
                            onImport: () => setImportOpen(true),
                            onProposalImport: () => setProposalImportOpen(true),
                            addRoomOpen,
                            onAddRoomOpenChange: setAddRoomOpen,
                            addCategoryOpen,
                            onAddCategoryOpenChange: setAddCategoryOpen,
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
                            onImport: () => setImportOpen(true),
                            onProposalImport: () => setProposalImportOpen(true),
                            addRoomOpen,
                            onAddRoomOpenChange: setAddRoomOpen,
                            addCategoryOpen,
                            onAddCategoryOpenChange: setAddCategoryOpen,
                          } satisfies ProjectContext
                        }
                      />
                    </section>
                  )}
                  {project && (
                    <>
                      <ImportExcelModal
                        open={importOpen}
                        projectId={project.id}
                        rooms={roomsWithItems}
                        onClose={() => setImportOpen(false)}
                        onSuccess={() => {
                          setImportOpen(false);
                          void queryClient.invalidateQueries();
                        }}
                      />
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
        </>
      )}
    </main>
  );
}

function BudgetPageActions({
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
  const { data: proposalCustomColumnDefs = [] } = useColumnDefs(project.id, 'proposal');

  const proposalColumnOrder = () => readColumnConfigFromStorage(project.id, 'proposal')?.order;

  return (
    <div className={isColumn ? 'sidebar-button-group' : 'flex items-center gap-2'}>
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
      <ExportMenu
        label="Export"
        size="sm"
        buttonVariant="toolbar"
        {...(isColumn ? { className: 'w-full', buttonClassName: 'sidebar-button' } : {})}
        onCsv={() => {
          exportSummaryCsv(project, roomsWithItems);
          exportProposalCsv(
            project,
            proposalCategoriesWithItems,
            proposalCustomColumnDefs,
            proposalColumnOrder(),
          );
        }}
        onExcel={() => {
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
        onPdf={() => {
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
      />
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

function ProjectRedirectTo({ target }: { target: string }) {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}/${target}`} replace />;
}

function ProjectListRoute() {
  const { project } = useProjectContext();
  const { groups, isLoading } = useFfeCatalogGroups(project.id);
  return <FfeItemList projectId={project.id} groups={groups} isLoading={isLoading} />;
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
  const { project, onProposalImport, addCategoryOpen, onAddCategoryOpenChange } =
    useProjectContext();
  return (
    <ProposalTable
      projectId={project.id}
      project={project}
      onImport={onProposalImport}
      addCategoryOpen={addCategoryOpen}
      onAddCategoryOpenChange={onAddCategoryOpenChange}
    />
  );
}

function ProjectCatalogRoute() {
  const { project } = useProjectContext();
  const { groups } = useFfeCatalogGroups(project.id);
  return <CatalogView project={project} rooms={groups} />;
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
