import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGate, SignInPage } from './components/shared/AuthGate';
import { CatalogView } from './components/ffe/catalog/CatalogView';
import { ItemsTable } from './components/ffe/items/ItemsTable';
import { MaterialsView } from './components/materials/MaterialsView';
import { DeleteProjectModal } from './components/project/DeleteProjectModal';
import { EditProjectModal } from './components/project/EditProjectModal';
import { ExportMenu } from './components/shared/ExportMenu';
import { ImportExcelModal } from './components/ffe/import/ImportExcelModal';
import { ImportTakeoffExcelModal } from './components/takeoff/import/ImportTakeoffExcelModal';
import { ProjectHeader } from './components/project/ProjectHeader';
import { ProjectImagesModal } from './components/project/ProjectImagesModal';
import { ProjectOptionsMenu } from './components/project/ProjectOptionsMenu';
import { SummaryView } from './components/ffe/summary/SummaryView';
import { TakeoffSummaryView } from './components/takeoff/summary/TakeoffSummaryView';
import { TakeoffTable } from './components/takeoff/table/TakeoffTable';
import { exportSummaryCsv, exportSummaryExcel, exportSummaryPdf } from './lib/exportUtils';
import { recordSession } from './lib/telemetry';
import { useProjects, useUpdateProject, useDeleteProject } from './hooks/shared/useProjects';
import { useRoomsWithItems } from './hooks/ffe/useRoomsWithItems';
import { useTakeoffWithItems } from './hooks/takeoff/useTakeoff';
import { DashboardPage } from './pages/DashboardPage';
import type { Project, RoomWithItems, TakeoffCategoryWithItems } from './types';

type ProjectContext = {
  project: Project;
  roomsWithItems: RoomWithItems[];
  takeoffCategoriesWithItems: TakeoffCategoryWithItems[];
  onImport: () => void;
  onTakeoffImport: () => void;
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
          <Route index element={<ProjectToolRedirect tool="ffe" />} />
          <Route path="ffe" element={<ProjectToolRedirect tool="ffe" />} />
          <Route path="ffe/table" element={<ProjectTableRoute />} />
          <Route path="ffe/catalog" element={<ProjectCatalogRoute />} />
          <Route path="ffe/materials" element={<ProjectMaterialsRoute />} />
          <Route path="ffe/summary" element={<ProjectSummaryRoute />} />
          <Route path="takeoff" element={<ProjectToolRedirect tool="takeoff" />} />
          <Route path="takeoff/table" element={<ProjectTakeoffRoute />} />
          <Route path="takeoff/materials" element={<ProjectTakeoffMaterialsRoute />} />
          <Route path="takeoff/summary" element={<ProjectTakeoffSummaryRoute />} />
          <Route path="table" element={<Navigate to="ffe/table" replace />} />
          <Route path="catalog" element={<Navigate to="ffe/catalog" replace />} />
          <Route path="materials" element={<Navigate to="ffe/materials" replace />} />
          <Route path="summary" element={<Navigate to="ffe/summary" replace />} />
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
  const { categoriesWithItems: takeoffCategoriesWithItems, isLoading: takeoffLoading } =
    useTakeoffWithItems(id ?? '');
  const [importOpen, setImportOpen] = useState(false);
  const [takeoffImportOpen, setTakeoffImportOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [imageProject, setImageProject] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  // Projects loaded but this ID doesn't exist → 404
  if (!projectsLoading && projects !== undefined && !project) return <NotFound />;

  const isLoading = projectsLoading || dataLoading || takeoffLoading;
  return (
    <main className="min-h-screen bg-surface-muted">
      <ProjectHeader project={project} showToolNavigation={false} />
      {isLoading ? (
        <div className="flex justify-center py-24">
          <div className="h-8 w-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
        </div>
      ) : project ? (
        <>
          <h1 className="sr-only">{project.name}</h1>
          <nav
            aria-label="Project sections"
            className="no-print border-b border-gray-200 bg-white px-4 md:px-6"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ProjectOptionsMenu
                  projectName={project.name}
                  open={headerMenuOpen}
                  align="bottom"
                  onToggle={() => setHeaderMenuOpen((open) => !open)}
                  onEdit={() => {
                    setHeaderMenuOpen(false);
                    setEditProject(project);
                  }}
                  onImages={() => {
                    setHeaderMenuOpen(false);
                    setImageProject(project);
                  }}
                  onDelete={() => {
                    setHeaderMenuOpen(false);
                    setPendingDelete(project);
                  }}
                />
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                  <nav aria-label="Project tools" className="flex items-center gap-2">
                    {(
                      [
                        [`/projects/${project.id}/ffe/table`, 'FF&E'],
                        [`/projects/${project.id}/takeoff/table`, 'Take-Off Table'],
                      ] as const
                    ).map(([to, label]) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                          [
                            'whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium transition',
                            isActive
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-brand-500 hover:text-brand-700',
                          ].join(' ')
                        }
                      >
                        {label}
                      </NavLink>
                    ))}
                  </nav>
                  <div className="h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />
                  <div className="flex gap-2 overflow-x-auto">
                    {getSectionTabs(location.pathname).map(([to, label]) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                          [
                            'border-b-2 px-3 py-3 text-sm font-medium',
                            isActive
                              ? 'border-brand-500 text-brand-700'
                              : 'border-transparent text-gray-600 hover:text-brand-700',
                          ].join(' ')
                        }
                      >
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
              {project && (
                <ProjectTabActions
                  activePath={location.pathname}
                  project={project}
                  roomsWithItems={roomsWithItems}
                />
              )}
            </div>
          </nav>
          <section className="project-content mx-auto max-w-7xl px-4 py-6 md:px-6">
            <Outlet
              context={
                {
                  project,
                  roomsWithItems,
                  takeoffCategoriesWithItems,
                  onImport: () => setImportOpen(true),
                  onTakeoffImport: () => setTakeoffImportOpen(true),
                } satisfies ProjectContext
              }
            />
          </section>
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
              <ImportTakeoffExcelModal
                open={takeoffImportOpen}
                projectId={project.id}
                categories={takeoffCategoriesWithItems}
                onClose={() => setTakeoffImportOpen(false)}
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
    </main>
  );
}

function ProjectTabActions({
  activePath,
  project,
  roomsWithItems,
}: {
  activePath: string;
  project: Project;
  roomsWithItems: RoomWithItems[];
}) {
  if (activePath.endsWith('/ffe/table')) {
    return <div className="min-h-8" />;
  }

  if (activePath.endsWith('/ffe/summary')) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ExportMenu
          label="Export"
          size="sm"
          onCsv={() => exportSummaryCsv(project, roomsWithItems)}
          onExcel={() => exportSummaryExcel(project, roomsWithItems)}
          onPdf={() => exportSummaryPdf(project, roomsWithItems)}
        />
      </div>
    );
  }

  if (activePath.endsWith('/takeoff/table')) {
    return <div className="min-h-8" />;
  }

  return <div className="min-h-8" />;
}

function getSectionTabs(pathname: string): [string, string][] {
  if (pathname.includes('/takeoff')) {
    return [
      ['takeoff/table', 'Table'],
      ['takeoff/materials', 'Materials'],
      ['takeoff/summary', 'Summary'],
    ];
  }

  return [
    ['ffe/table', 'Table'],
    ['ffe/catalog', 'Catalog'],
    ['ffe/materials', 'Materials'],
    ['ffe/summary', 'Summary'],
  ];
}

function ProjectTableRoute() {
  const { project, roomsWithItems, onImport } = useProjectContext();
  return (
    <ItemsTable
      projectId={project.id}
      project={project}
      roomsWithItems={roomsWithItems}
      onImport={onImport}
    />
  );
}

function ProjectToolRedirect({ tool }: { tool: 'ffe' | 'takeoff' }) {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}/${tool}/table`} replace />;
}

function ProjectTakeoffRoute() {
  const { project, onTakeoffImport } = useProjectContext();
  return <TakeoffTable projectId={project.id} project={project} onImport={onTakeoffImport} />;
}

function ProjectTakeoffMaterialsRoute() {
  const { project, roomsWithItems, takeoffCategoriesWithItems } = useProjectContext();
  return (
    <MaterialsView
      project={project}
      tool="takeoff"
      roomsWithItems={roomsWithItems}
      takeoffCategoriesWithItems={takeoffCategoriesWithItems}
    />
  );
}

function ProjectTakeoffSummaryRoute() {
  const { project, takeoffCategoriesWithItems } = useProjectContext();
  return <TakeoffSummaryView project={project} categories={takeoffCategoriesWithItems} />;
}

function ProjectCatalogRoute() {
  const { project, roomsWithItems } = useProjectContext();
  return <CatalogView project={project} rooms={roomsWithItems} />;
}

function ProjectSummaryRoute() {
  const { project, roomsWithItems } = useProjectContext();
  return <SummaryView project={project} roomsWithItems={roomsWithItems} />;
}

function ProjectMaterialsRoute() {
  const { project, roomsWithItems, takeoffCategoriesWithItems } = useProjectContext();
  return (
    <MaterialsView
      project={project}
      tool="ffe"
      roomsWithItems={roomsWithItems}
      takeoffCategoriesWithItems={takeoffCategoriesWithItems}
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
