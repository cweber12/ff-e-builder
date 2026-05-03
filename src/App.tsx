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
import { ExportMenu } from './components/shared/ExportMenu';
import { ImportExcelModal } from './components/ffe/import/ImportExcelModal';
import { ImportTakeoffExcelModal } from './components/takeoff/import/ImportTakeoffExcelModal';
import { NewProjectModal } from './components/project/NewProjectModal';
import { ProjectHeader } from './components/project/ProjectHeader';
import { ProjectImagesModal } from './components/project/ProjectImagesModal';
import { SummaryView } from './components/ffe/summary/SummaryView';
import { TakeoffSummaryView } from './components/takeoff/summary/TakeoffSummaryView';
import { TakeoffTable } from './components/takeoff/table/TakeoffTable';
import { ImageFrame } from './components/shared/ImageFrame';
import { projectTotalCents, takeoffProjectTotalCents } from './lib/calc';
import {
  exportSummaryCsv,
  exportSummaryExcel,
  exportSummaryPdf,
  exportTakeoffCsv,
  exportTakeoffExcel,
  exportTakeoffPdf,
  exportTableCsv,
  exportTableExcel,
  exportTablePdf,
} from './lib/exportUtils';
import { recordSession } from './lib/telemetry';
import { useProjects, useUpdateProject, useDeleteProject } from './hooks/shared/useProjects';
import { useRoomsWithItems } from './hooks/ffe/useRoomsWithItems';
import { useTakeoffWithItems } from './hooks/takeoff/useTakeoff';
import { useUpdateUserProfile, useUserProfile } from './hooks/shared/useUserProfile';
import { Button } from './components/primitives';
import type { Project, RoomWithItems, TakeoffCategoryWithItems } from './types';

type ProjectContext = {
  project: Project;
  roomsWithItems: RoomWithItems[];
  takeoffCategoriesWithItems: TakeoffCategoryWithItems[];
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
          <Route index element={<ProjectToolChooser />} />
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
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [imageProject, setImageProject] = useState<Project | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              ChillDesignStudio
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-950">Projects</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage FF&amp;E schedules, catalogs, materials, and take-off tables.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            + New project
          </button>
        </div>

        <UserInfoSection />

        {isLoading ? (
          <div className="mt-8 flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : !projects?.length ? (
          <NoProjectsEmptyState onCreate={() => setNewProjectOpen(true)} />
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="group relative rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-brand-500 hover:shadow-md focus-within:border-brand-500"
              >
                <div className="p-3 pb-0">
                  <ImageFrame
                    entityType="project"
                    entityId={project.id}
                    alt={`${project.name} project`}
                    className="h-36 w-full"
                    disabled
                  />
                </div>
                <Link
                  to={`/projects/${project.id}`}
                  className="block p-5 focus-visible:outline-none"
                >
                  {project.clientName && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                      {project.clientName}
                    </p>
                  )}
                  <h2 className="mt-3 text-xl font-semibold text-gray-950">{project.name}</h2>
                  {(project.companyName || project.projectLocation) && (
                    <p className="mt-2 text-sm text-gray-500">
                      {[project.companyName, project.projectLocation].filter(Boolean).join(' | ')}
                    </p>
                  )}
                </Link>
                <div className="absolute bottom-3 right-3">
                  <button
                    type="button"
                    aria-label={`Open options for ${project.name}`}
                    aria-expanded={openProjectMenuId === project.id}
                    onClick={() =>
                      setOpenProjectMenuId((current) =>
                        current === project.id ? null : project.id,
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    <MoreIcon />
                  </button>
                  {openProjectMenuId === project.id && (
                    <div className="absolute bottom-full right-0 z-20 mb-1 min-w-44 rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg">
                      <button
                        type="button"
                        className="flex w-full rounded px-2 py-1.5 text-left text-gray-700 hover:bg-brand-50"
                        onClick={() => {
                          setOpenProjectMenuId(null);
                          setImageProject(project);
                        }}
                      >
                        Project images
                      </button>
                      <button
                        type="button"
                        className="flex w-full rounded px-2 py-1.5 text-left text-danger-600 hover:bg-red-50"
                        onClick={() => {
                          setOpenProjectMenuId(null);
                          setPendingDelete(project);
                        }}
                      >
                        Delete project
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
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
  const { roomsWithItems, isLoading: dataLoading } = useRoomsWithItems(id ?? '');
  const { categoriesWithItems: takeoffCategoriesWithItems, isLoading: takeoffLoading } =
    useTakeoffWithItems(id ?? '');
  const [importOpen, setImportOpen] = useState(false);
  const [takeoffImportOpen, setTakeoffImportOpen] = useState(false);

  // Projects loaded but this ID doesn't exist → 404
  if (!projectsLoading && projects !== undefined && !project) return <NotFound />;

  const isLoading = projectsLoading || dataLoading || takeoffLoading;
  const ffeActualCents = projectTotalCents(roomsWithItems);
  const takeoffActualCents = takeoffProjectTotalCents(takeoffCategoriesWithItems);
  const actualCents =
    project?.budgetMode === 'individual' ? ffeActualCents : ffeActualCents + takeoffActualCents;

  return (
    <main className="min-h-screen bg-surface-muted">
      <ProjectHeader
        project={project}
        actualCents={actualCents}
        onNameSave={(name) => updateProject.mutate({ id: id!, patch: { name } })}
        onClientSave={(clientName) => updateProject.mutate({ id: id!, patch: { clientName } })}
        onCompanySave={(companyName) => updateProject.mutate({ id: id!, patch: { companyName } })}
        onLocationSave={(projectLocation) =>
          updateProject.mutate({ id: id!, patch: { projectLocation } })
        }
        onBudgetSave={(budgetCents) => updateProject.mutate({ id: id!, patch: { budgetCents } })}
        onFfeBudgetSave={(ffeBudgetCents) =>
          updateProject.mutate({ id: id!, patch: { ffeBudgetCents } })
        }
        onTakeoffBudgetSave={(takeoffBudgetCents) =>
          updateProject.mutate({ id: id!, patch: { takeoffBudgetCents } })
        }
        onBudgetModeSave={(budgetMode) => updateProject.mutate({ id: id!, patch: { budgetMode } })}
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
                  takeoffCategoriesWithItems={takeoffCategoriesWithItems}
                  onImport={() => setImportOpen(true)}
                  onTakeoffImport={() => setTakeoffImportOpen(true)}
                />
              )}
            </div>
          </nav>
          <section className="project-content mx-auto max-w-7xl px-4 py-6 md:px-6">
            <Outlet
              context={
                { project, roomsWithItems, takeoffCategoriesWithItems } satisfies ProjectContext
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
                  setTakeoffImportOpen(false);
                  void queryClient.invalidateQueries();
                }}
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
  takeoffCategoriesWithItems,
  onImport,
  onTakeoffImport,
}: {
  activePath: string;
  project: Project;
  roomsWithItems: RoomWithItems[];
  takeoffCategoriesWithItems: TakeoffCategoryWithItems[];
  onImport: () => void;
  onTakeoffImport: () => void;
}) {
  if (activePath.endsWith('/ffe/table')) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ExportMenu
          label="Export all"
          size="sm"
          onCsv={() => exportTableCsv(project, roomsWithItems)}
          onExcel={() => exportTableExcel(project, roomsWithItems)}
          onPdf={() => exportTablePdf(project, roomsWithItems)}
        />
        <Button type="button" variant="secondary" size="sm" onClick={onImport}>
          Import from Excel
        </Button>
      </div>
    );
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
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ExportMenu
          label="Export"
          size="sm"
          onCsv={() => exportTakeoffCsv(project, takeoffCategoriesWithItems)}
          onExcel={() => void exportTakeoffExcel(project, takeoffCategoriesWithItems)}
          onPdf={() => void exportTakeoffPdf(project, takeoffCategoriesWithItems)}
        />
        <Button type="button" variant="secondary" size="sm" onClick={onTakeoffImport}>
          Import from Excel
        </Button>
      </div>
    );
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
  const { project, roomsWithItems } = useProjectContext();
  return <ItemsTable projectId={project.id} project={project} roomsWithItems={roomsWithItems} />;
}

function ProjectToolRedirect({ tool }: { tool: 'ffe' | 'takeoff' }) {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}/${tool}/table`} replace />;
}

function ProjectTakeoffRoute() {
  const { project } = useProjectContext();
  return <TakeoffTable projectId={project.id} />;
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

function ProjectToolChooser() {
  const { project, roomsWithItems, takeoffCategoriesWithItems } = useProjectContext();
  const hasFfe = roomsWithItems.some((room) => room.items.length > 0);
  const hasTakeoff = takeoffCategoriesWithItems.some((category) => category.items.length > 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ToolCard
        to="ffe/table"
        title={hasFfe ? 'Open FF&E' : 'Create FF&E'}
        description="Rooms, items, materials, catalog pages, and FF&E exports."
        meta={`${roomsWithItems.length} rooms`}
      />
      <ToolCard
        to="takeoff/table"
        title={hasTakeoff ? 'Open Take-Off Table' : 'Create Take-Off Table'}
        description="Category-based quantities, drawings, swatches, CBM, and cost totals."
        meta={`${takeoffCategoriesWithItems.length} categories`}
      />
      <p className="md:col-span-2 text-sm text-gray-500">
        {project.name} can use either tool independently, or move between both from the project
        tabs.
      </p>
    </div>
  );
}

function ToolCard({
  to,
  title,
  description,
  meta,
}: {
  to: string;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-brand-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{meta}</span>
      <h2 className="mt-3 text-2xl font-semibold text-gray-950">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </Link>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
    </svg>
  );
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

function UserInfoSection() {
  const { data: profile } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone);
    setCompanyName(profile.companyName);
  }, [profile]);

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-950">User information</span>
          <span className="text-sm text-gray-500">
            {[profile?.name, profile?.email, profile?.companyName].filter(Boolean).join(' | ') ||
              'Add contact details for project documentation'}
          </span>
        </span>
        <span className="text-sm font-medium text-brand-700">{open ? 'Close' : 'Edit'}</span>
      </button>
      {open && (
        <form
          className="mt-4 grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateProfile.mutate({ name, email, phone, companyName });
          }}
        >
          {[
            ['Name', name, setName],
            ['Email', email, setEmail],
            ['Phone', phone, setPhone],
            ['Company', companyName, setCompanyName],
          ].map(([label, value, setter]) => (
            <label
              key={label as string}
              className="flex flex-col gap-1 text-sm font-medium text-gray-700"
            >
              {label as string}
              <input
                type={label === 'Email' ? 'email' : 'text'}
                value={value as string}
                onChange={(event) => (setter as (next: string) => void)(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
          ))}
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={updateProfile.isPending}>
              Save
            </Button>
          </div>
        </form>
      )}
    </section>
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
