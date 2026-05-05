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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthGate, SignInPage } from './components/shared/AuthGate';
import { CatalogView } from './components/ffe/catalog/CatalogView';
import { ItemsTable } from './components/ffe/items/ItemsTable';
import { MaterialsView } from './components/materials/MaterialsView';
import { DeleteProjectModal } from './components/project/DeleteProjectModal';
import { EditProjectModal } from './components/project/EditProjectModal';
import { ExportMenu } from './components/shared/ExportMenu';
import { ImportExcelModal } from './components/ffe/import/ImportExcelModal';
import { ImportTakeoffExcelModal } from './components/takeoff/import/ImportTakeoffExcelModal';
import { NewProjectModal } from './components/project/NewProjectModal';
import { ProjectHeader } from './components/project/ProjectHeader';
import { ProjectImagesModal } from './components/project/ProjectImagesModal';
import { ProjectOptionsMenu } from './components/project/ProjectOptionsMenu';
import { SummaryView } from './components/ffe/summary/SummaryView';
import { TakeoffSummaryView } from './components/takeoff/summary/TakeoffSummaryView';
import { TakeoffTable } from './components/takeoff/table/TakeoffTable';
import { ImageFrame } from './components/shared/ImageFrame';
import { exportSummaryCsv, exportSummaryExcel, exportSummaryPdf } from './lib/exportUtils';
import { api } from './lib/api';
import { recordSession } from './lib/telemetry';
import { useProjects, useUpdateProject, useDeleteProject } from './hooks/shared/useProjects';
import { useRoomsWithItems } from './hooks/ffe/useRoomsWithItems';
import { useTakeoffWithItems } from './hooks/takeoff/useTakeoff';
import { useUserProfile } from './hooks/shared/useUserProfile';
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
        <Route path="/projects" element={<ProjectList />} />
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

function ProjectList() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [imageProject, setImageProject] = useState<Project | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [openProjectActionId, setOpenProjectActionId] = useState<string | null>(null);
  const { data: projects, isLoading } = useProjects();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { data: userProfile } = useUserProfile();
  const firstName = userProfile?.name?.trim().split(' ')[0];
  const { data: activeProjectToolState, isLoading: isProjectToolStateLoading } = useQuery({
    queryKey: ['projects', 'tool-state', openProjectActionId],
    enabled: openProjectActionId !== null,
    queryFn: async () => {
      if (!openProjectActionId) return { hasFfe: false, hasTakeoff: false };
      const [rooms, takeoffCategories] = await Promise.all([
        api.rooms.list(openProjectActionId),
        api.takeoff.categories(openProjectActionId),
      ]);
      return {
        hasFfe: rooms.length > 0,
        hasTakeoff: takeoffCategories.length > 0,
      };
    },
  });
  const companies = Array.from(
    new Set((projects ?? []).map((project) => project.companyName?.trim()).filter(Boolean)),
  );

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="p-1">
          <h1 className="text-3xl font-bold text-gray-950">
            {firstName ? `Hi, ${firstName}` : 'Welcome'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Use ChillDesignStudio to organize project specifications, build FF&amp;E and take-off
            deliverables, and export polished documentation for stakeholders.
          </p>
        </section>

        <section className="p-1">
          <h2 className="text-xl font-semibold text-gray-950">Companies</h2>
          <p className="mt-1 text-sm text-gray-500">
            Themes and company-level settings will be managed here.
          </p>
          {companies.length ? (
            <div className="mt-4 max-h-72 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                {companies.map((companyName) => {
                  const projectCount = (projects ?? []).filter(
                    (project) => project.companyName?.trim() === companyName,
                  ).length;
                  return (
                    <article
                      key={companyName}
                      className="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm"
                    >
                      <h3 className="text-sm font-semibold text-gray-950">{companyName}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {projectCount} {projectCount === 1 ? 'project' : 'projects'}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              No companies available yet. Create or update a project with a company name to populate
              this section.
            </p>
          )}
        </section>

        <section className="p-1">
          <div className="mb-4 flex flex-wrap items-center justify-start gap-4">
            <h2 className="text-xl font-semibold text-gray-950">Projects</h2>
            <button
              type="button"
              aria-label="Add project"
              title="Add project"
              onClick={() => setNewProjectOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <PlusIcon />
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : !projects?.length ? (
            <NoProjectsEmptyState onCreate={() => setNewProjectOpen(true)} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <article
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setOpenProjectMenuId(null);
                    setOpenProjectActionId((current) =>
                      current === project.id ? null : project.id,
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setOpenProjectMenuId(null);
                    setOpenProjectActionId((current) =>
                      current === project.id ? null : project.id,
                    );
                  }}
                  className="project-card group relative cursor-pointer overflow-visible rounded-lg border border-gray-200 bg-white shadow-sm focus-within:border-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <div className="p-3 pb-0">
                    <div className="relative overflow-hidden rounded-lg">
                      <ImageFrame
                        entityType="project"
                        entityId={project.id}
                        alt={`${project.name} project`}
                        className="project-card-media h-36 w-full"
                        disabled
                      />
                      {openProjectActionId === project.id && (
                        <div
                          className="project-card-action-popover absolute inset-0 z-20 flex flex-col justify-center rounded-lg p-3"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                            Open project tool
                          </p>
                          <div className="mt-2 grid gap-2">
                            <Link
                              to={`/projects/${project.id}/ffe/table`}
                              className="project-card-action-link rounded-md px-3 py-2 text-sm font-medium"
                              onClick={() => setOpenProjectActionId(null)}
                            >
                              {isProjectToolStateLoading
                                ? 'Checking FF&E...'
                                : activeProjectToolState?.hasFfe
                                  ? 'Open FF&E'
                                  : 'Create FF&E'}
                            </Link>
                            <Link
                              to={`/projects/${project.id}/takeoff/table`}
                              className="project-card-action-link rounded-md px-3 py-2 text-sm font-medium"
                              onClick={() => setOpenProjectActionId(null)}
                            >
                              {isProjectToolStateLoading
                                ? 'Checking Take-Off...'
                                : activeProjectToolState?.hasTakeoff
                                  ? 'Open Take-Off'
                                  : 'Create Take-Off'}
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative block p-5">
                    {project.clientName && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                        {project.clientName}
                      </p>
                    )}
                    <h3 className="mt-3 text-xl font-semibold text-gray-950">{project.name}</h3>
                    {(project.companyName || project.projectLocation) && (
                      <p className="mt-2 text-sm text-gray-500">
                        {[project.companyName, project.projectLocation].filter(Boolean).join(' | ')}
                      </p>
                    )}
                  </div>
                  <div
                    className="absolute bottom-3 right-3"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <ProjectOptionsMenu
                      projectName={project.name}
                      open={openProjectMenuId === project.id}
                      onToggle={() =>
                        setOpenProjectMenuId((current) =>
                          current === project.id ? null : project.id,
                        )
                      }
                      onEdit={() => {
                        setOpenProjectMenuId(null);
                        setEditProject(project);
                      }}
                      onImages={() => {
                        setOpenProjectMenuId(null);
                        setImageProject(project);
                      }}
                      onDelete={() => {
                        setOpenProjectMenuId(null);
                        setPendingDelete(project);
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
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
        onConfirm={(id) => deleteProject.mutate(id)}
      />
      <ProjectImagesModal
        project={imageProject}
        open={imageProject !== null}
        onClose={() => setImageProject(null)}
      />
    </main>
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
      />
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NoProjectsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-10 flex min-h-[24rem] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <div className="flex max-w-md flex-col items-center gap-5">
        <svg aria-hidden="true" viewBox="0 0 220 160" className="h-36 w-48">
          <rect x="38" y="36" width="132" height="92" rx="8" fill="#F1F5F2" />
          <path d="M62 62h84M62 82h64M62 102h76" stroke="#1A6B4A" strokeWidth="6" />
          <circle cx="164" cy="46" r="24" fill="#1A6B4A" opacity="0.12" />
          <path d="M154 46h20M164 36v20" stroke="#1A6B4A" strokeWidth="6" />
        </svg>
        <div>
          <h2 className="text-xl font-semibold text-gray-950">No projects yet</h2>
          <p className="mt-2 text-sm text-gray-600">
            Create your first project to start organizing rooms, items, budgets, and catalog pages.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          Create your first project
        </button>
      </div>
    </div>
  );
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
