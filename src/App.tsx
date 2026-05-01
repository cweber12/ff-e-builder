import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { AuthGate, SignInPage } from './components/AuthGate';
import { CatalogView } from './components/CatalogView';
import { ItemsTable, type RoomWithItems } from './components/ItemsTable';
import { NewProjectModal } from './components/NewProjectModal';
import { ProjectHeader } from './components/ProjectHeader';
import { SummaryView } from './components/SummaryView';
import { projectTotalCents } from './lib/calc';
import { recordSession } from './lib/telemetry';
import { useProjects, useUpdateProject } from './hooks/useProjects';
import { useRoomsWithItems } from './hooks/useRoomsWithItems';
import type { Project } from './types';

type ProjectContext = {
  project: Project;
  roomsWithItems: RoomWithItems[];
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
          <Route index element={<Navigate to="table" replace />} />
          <Route path="table" element={<ProjectTableRoute />} />
          <Route path="catalog" element={<ProjectCatalogRoute />} />
          <Route path="summary" element={<ProjectSummaryRoute />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ProjectList() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const { data: projects, isLoading } = useProjects();

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-950">Projects</h1>
            <p className="mt-1 text-sm text-gray-600">Manage FF&amp;E schedules and catalogs.</p>
          </div>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            + New project
          </button>
        </div>

        {isLoading ? (
          <div className="mt-8 flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : !projects?.length ? (
          <NoProjectsEmptyState onCreate={() => setNewProjectOpen(true)} />
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}/table`}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                {project.clientName && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {project.clientName}
                  </p>
                )}
                <h2 className="mt-3 text-xl font-semibold text-gray-950">{project.name}</h2>
              </Link>
            ))}
          </div>
        )}
      </div>
      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </main>
  );
}

function ProjectLayout() {
  const { id } = useParams();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const project = projects?.find((p) => p.id === id);
  const updateProject = useUpdateProject();
  const { roomsWithItems, isLoading: dataLoading } = useRoomsWithItems(id ?? '');

  // Projects loaded but this ID doesn't exist → 404
  if (!projectsLoading && projects !== undefined && !project) return <NotFound />;

  const isLoading = projectsLoading || dataLoading;
  const actualCents = projectTotalCents(roomsWithItems);

  return (
    <main className="min-h-screen bg-surface-muted">
      <ProjectHeader
        project={project}
        actualCents={actualCents}
        onNameSave={(name) => updateProject.mutate({ id: id!, patch: { name } })}
        onClientSave={(clientName) => updateProject.mutate({ id: id!, patch: { clientName } })}
        onBudgetSave={(budgetCents) => updateProject.mutate({ id: id!, patch: { budgetCents } })}
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
                {(
                  [
                    ['table', 'Table'],
                    ['catalog', 'Catalog'],
                    ['summary', 'Summary'],
                  ] as const
                ).map(([to, label]) => (
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
              <button
                type="button"
                onClick={() => exportProjectCsv(project, roomsWithItems)}
                className="shrink-0 rounded-md border border-brand-500 bg-white px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Export CSV
              </button>
            </div>
          </nav>
          <section className="project-content mx-auto max-w-7xl px-4 py-6 md:px-6">
            <Outlet context={{ project, roomsWithItems } satisfies ProjectContext} />
          </section>
        </>
      ) : null}
    </main>
  );
}

function ProjectTableRoute() {
  const { project, roomsWithItems } = useProjectContext();
  return <ItemsTable projectId={project.id} roomsWithItems={roomsWithItems} />;
}

function ProjectCatalogRoute() {
  const { project, roomsWithItems } = useProjectContext();
  return <CatalogView project={project} rooms={roomsWithItems} />;
}

function ProjectSummaryRoute() {
  const { project, roomsWithItems } = useProjectContext();
  return <SummaryView project={project} roomsWithItems={roomsWithItems} />;
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

function exportProjectCsv(project: Project, roomsWithItems: RoomWithItems[]) {
  const rows = [
    [
      'Project',
      'Room',
      'Item ID',
      'Item',
      'Category',
      'Vendor',
      'Qty',
      'Unit Cost Cents',
      'Markup %',
      'Status',
    ],
    ...roomsWithItems.flatMap((room) =>
      room.items.map((item) => [
        project.name,
        room.name,
        item.itemIdTag ?? '',
        item.itemName,
        item.category ?? '',
        item.vendor ?? '',
        String(item.qty),
        String(item.unitCostCents),
        String(item.markupPct),
        item.status,
      ]),
    ),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-items.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
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
