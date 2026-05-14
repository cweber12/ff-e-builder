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
import { AuthGate, SignInPage } from './components/shared/auth/AuthGate';
import { CatalogView } from './components/ffe/catalog/CatalogView';
import { FfeTable } from './components/ffe/items';
import { MaterialsView } from './components/materials/MaterialsView';
import { BudgetView } from './components/project/BudgetView';
import { DeleteProjectModal } from './components/project/modals/DeleteProjectModal';
import { EditProjectModal } from './components/project/modals/EditProjectModal';
import { FfeBudgetModal } from './components/project/modals/FfeBudgetModal';
import { ProposalBudgetModal } from './components/project/modals/ProposalBudgetModal';
import { ImportExcelModal } from './components/ffe/import/ImportExcelModal';
import { ImportProposalExcelModal } from './components/proposal/import/ImportProposalExcelModal';
import { ProjectHeader } from './components/project/ProjectHeader';
import { ProjectImagesModal } from './components/project/modals/ProjectImagesModal';
import { ExportMenu } from './components/shared/ExportMenu';
import { ProposalTable } from './components/proposal/table/ProposalTable';
import { FfeActions, ProposalActions } from './components/project/AppBarActions';
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
  useProjects,
  useUpdateProject,
  useDeleteProject,
  useRoomsWithItems,
  useProposalWithItems,
} from './hooks';
import { DashboardPage } from './pages/DashboardPage';
import { PlanCanvasPage } from './pages/PlanCanvasPage';
import { ProjectOverviewPage } from './pages/ProjectOverviewPage';
import { PlansPage } from './pages/PlansPage';
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
        <Route path="/projects/:id" element={<ProjectLayout />}>
          <Route index element={<ProjectOverviewRoute />} />
          <Route path="snapshot" element={<Navigate to=".." replace />} />
          <Route path="ffe" element={<ProjectToolRedirect tool="ffe" />} />
          <Route path="ffe/table" element={<ProjectTableRoute />} />
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
          <Route path="table" element={<Navigate to="ffe/table" replace />} />
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
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { roomsWithItems, isLoading: dataLoading } = useRoomsWithItems(id ?? '');
  const { categoriesWithItems: proposalCategoriesWithItems, isLoading: proposalLoading } =
    useProposalWithItems(id ?? '');
  const [importOpen, setImportOpen] = useState(false);
  const [proposalImportOpen, setProposalImportOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [imageProject, setImageProject] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  // Lifted modal state for table routes
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);

  const isPlanCanvasRoute = /^\/projects\/[^/]+\/plans\/[^/]+$/.test(location.pathname);
  const isFfeRoute = !!id && location.pathname.includes(`/projects/${id}/ffe`);
  const isProposalRoute = !!id && location.pathname.includes(`/projects/${id}/proposal`);
  const isTableRoute = isFfeRoute || isProposalRoute;
  const isCatalogRoute = location.pathname.includes('/ffe/catalog');
  const isBudgetRoute = !!id && location.pathname.endsWith('/budget');

  // Projects loaded but this ID doesn't exist → 404
  if (!projectsLoading && projects !== undefined && !project) return <NotFound />;

  const isLoading = projectsLoading || dataLoading || proposalLoading;

  // Action cluster rendered in the app bar's right side
  const headerActions =
    !isLoading && project ? (
      isFfeRoute ? (
        <FfeActions
          project={project}
          roomsWithItems={roomsWithItems}
          isCatalog={isCatalogRoute}
          onAddRoom={() => setAddRoomOpen(true)}
          onImport={() => setImportOpen(true)}
        />
      ) : isProposalRoute ? (
        <ProposalActions
          project={project}
          categoriesWithItems={proposalCategoriesWithItems}
          onAddCategory={() => setAddCategoryOpen(true)}
          onImport={() => setProposalImportOpen(true)}
        />
      ) : isBudgetRoute ? (
        <BudgetPageActions
          project={project}
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
        />
      ) : null
    ) : null;

  return (
    <main
      className={[
        'flex flex-col',
        isPlanCanvasRoute || isTableRoute
          ? 'h-screen overflow-hidden bg-neutral-50'
          : 'min-h-screen bg-surface-muted',
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
          <ProjectHeader
            project={project}
            optionsOpen={headerMenuOpen}
            onToggleOptions={() => setHeaderMenuOpen((open) => !open)}
            onEditProject={() => {
              setHeaderMenuOpen(false);
              if (project) setEditProject(project);
            }}
            onProjectImages={() => {
              setHeaderMenuOpen(false);
              if (project) setImageProject(project);
            }}
            onDeleteProject={() => {
              setHeaderMenuOpen(false);
              if (project) setPendingDelete(project);
            }}
            actions={headerActions}
          />
          {isLoading ? (
            <div className="flex justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : project ? (
            <>
              <h1 className="sr-only">{project.name}</h1>
              {isTableRoute ? (
                // Full-width flush layout for FF&E and Proposal table routes
                <div className="flex flex-1 flex-col overflow-hidden bg-surface">
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
                  <EditProjectModal
                    project={editProject}
                    open={editProject !== null}
                    isSaving={updateProject.isPending}
                    onClose={() => setEditProject(null)}
                    onSave={async (projectId, patch) => {
                      await updateProject.mutateAsync({ id: projectId, patch });
                      setEditProject(null);
                    }}
                  />
                  <DeleteProjectModal
                    project={pendingDelete}
                    onClose={() => setPendingDelete(null)}
                    onConfirm={(projectId) => {
                      deleteProject.mutate(projectId);
                      setPendingDelete(null);
                    }}
                  />
                  <ProjectImagesModal
                    project={imageProject}
                    open={imageProject !== null}
                    onClose={() => setImageProject(null)}
                  />
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}

function BudgetPageActions({
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

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setFfeOpen(true)}
        className="rounded-md border border-neutral-200 bg-surface px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        FF&amp;E Budget
      </button>
      <button
        type="button"
        onClick={() => setProposalOpen(true)}
        className="rounded-md border border-neutral-200 bg-surface px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Proposal Budget
      </button>
      <ExportMenu
        label="Export"
        size="sm"
        onCsv={() => {
          exportSummaryCsv(project, roomsWithItems);
          exportProposalCsv(project, proposalCategoriesWithItems);
        }}
        onExcel={() => {
          void exportSummaryExcel(project, roomsWithItems);
          void exportProposalExcel(project, proposalCategoriesWithItems);
        }}
        onPdf={() => {
          exportSummaryPdf(project, roomsWithItems);
          void exportProposalPdf(project, proposalCategoriesWithItems);
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

function ProjectTableRoute() {
  const { project, roomsWithItems, onImport, addRoomOpen, onAddRoomOpenChange } =
    useProjectContext();
  return (
    <FfeTable
      projectId={project.id}
      project={project}
      roomsWithItems={roomsWithItems}
      onImport={onImport}
      addRoomOpen={addRoomOpen}
      onAddRoomOpenChange={onAddRoomOpenChange}
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
  const { project, roomsWithItems } = useProjectContext();
  return <CatalogView project={project} rooms={roomsWithItems} />;
}

function ProjectMaterialsRoute() {
  const { project, roomsWithItems, proposalCategoriesWithItems } = useProjectContext();
  return (
    <MaterialsView
      project={project}
      roomsWithItems={roomsWithItems}
      proposalCategoriesWithItems={proposalCategoriesWithItems}
    />
  );
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
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6 text-center">
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-950">Page not found</h1>
        <Link
          to="/projects"
          className="mt-6 inline-flex rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}

export default App;
