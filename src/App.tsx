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
import { Button } from './components/primitives/Button';
import { Modal } from './components/primitives/Modal';
import { projectTotalCents } from './lib/calc';
import { recordSession } from './lib/telemetry';
import { useProjects, useUpdateProject, useDeleteProject } from './hooks/useProjects';
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
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();

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
              <article
                key={project.id}
                className="group relative rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-brand-500 hover:shadow-md focus-within:border-brand-500"
              >
                <Link
                  to={`/projects/${project.id}/table`}
                  className="block p-5 focus-visible:outline-none"
                >
                  {project.clientName && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                      {project.clientName}
                    </p>
                  )}
                  <h2 className="mt-3 text-xl font-semibold text-gray-950">{project.name}</h2>
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(project)}
                  aria-label={`Delete ${project.name}`}
                  className="absolute right-3 top-3 rounded-md p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger-500 group-hover:opacity-100"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
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
    </main>
  );
}

function DeleteProjectModal({
  project,
  onClose,
  onConfirm,
}: {
  project: Project | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}) {
  if (!project) return null;
  return (
    <Modal open onClose={onClose} title="Delete project">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-600">
          Permanently delete <strong className="font-semibold text-gray-950">{project.name}</strong>
          ? All rooms and items will be removed. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              onConfirm(project.id);
              onClose();
            }}
          >
            Delete project
          </Button>
        </div>
      </div>
    </Modal>
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
  return <ItemsTable projectId={project.id} project={project} roomsWithItems={roomsWithItems} />;
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
