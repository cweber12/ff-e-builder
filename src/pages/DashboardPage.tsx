import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DeleteProjectModal } from '../components/project/modals/DeleteProjectModal';
import { EditProjectModal } from '../components/project/modals/EditProjectModal';
import { NewProjectModal } from '../components/project/modals/NewProjectModal';
import { ProjectImagesModal } from '../components/project/modals/ProjectImagesModal';
import { ProjectOptionsMenu } from '../components/project/ProjectOptionsMenu';
import { Button, ButtonLink } from '../components/primitives';
import { ImageFrame } from '../components/shared/image/ImageFrame';
import { useProjects, useUpdateProject, useDeleteProject, useUserProfile } from '../hooks';
import type { Project } from '../types';

export function DashboardPage() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [imageProject, setImageProject] = useState<Project | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [sort, setSort] = useState<'updated' | 'name' | 'company'>('updated');
  const { data: projects, isLoading } = useProjects();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { data: userProfile } = useUserProfile();
  const firstName = userProfile?.name?.trim().split(' ')[0];

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'company') {
        const co = (a.companyName ?? '').localeCompare(b.companyName ?? '');
        return co !== 0 ? co : a.name.localeCompare(b.name);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, sort]);

  const companies = Array.from(
    new Set((projects ?? []).map((p) => p.companyName?.trim()).filter(Boolean)),
  );

  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="flex items-start justify-between gap-4 pb-6">
          <div>
            <p className="eyebrow text-brand-600">Dashboard</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-neutral-950">
              {firstName ? `Welcome back, ${firstName}` : 'Welcome'}
            </h1>
          </div>
          <Button type="button" variant="primary" size="md" onClick={() => setNewProjectOpen(true)}>
            <PlusIcon />
            New Project
          </Button>
        </header>

        <section className="section-rule">
          <h2 className="eyebrow">Companies</h2>
          {companies.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {companies.map((companyName) => {
                const count = (projects ?? []).filter(
                  (p) => p.companyName?.trim() === companyName,
                ).length;
                return (
                  <ButtonLink
                    key={companyName}
                    to="/company"
                    variant="secondary"
                    size="sm"
                    className="h-auto gap-2 px-2.5 py-1 text-sm"
                  >
                    {companyName}
                    <span className="num border-l border-neutral-200 pl-2 text-xs font-semibold text-neutral-500">
                      {count}
                    </span>
                  </ButtonLink>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              Company groupings appear here once projects have a company name assigned.{' '}
              <Link to="/company" className="font-medium text-brand-600 hover:underline">
                Set up your company profile.
              </Link>
            </p>
          )}
        </section>

        <section className="section-rule">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-baseline gap-2">
              <span className="eyebrow">Projects</span>
              {projects?.length ? (
                <span className="num text-[11px] font-semibold text-neutral-400">
                  {projects.length}
                </span>
              ) : null}
            </h2>
            {(projects?.length ?? 0) > 1 && (
              <div className="flex items-center gap-4">
                {(['updated', 'name', 'company'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSort(option)}
                    className={[
                      'border-b-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none',
                      sort === option
                        ? 'border-brand-600 text-neutral-900'
                        : 'border-transparent text-neutral-400 hover:text-neutral-700',
                    ].join(' ')}
                  >
                    {option === 'updated' ? 'Recent' : option === 'name' ? 'Name' : 'Company'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <ProjectListSkeleton />
          ) : !projects?.length ? (
            <NoProjectsEmptyState onCreate={() => setNewProjectOpen(true)} />
          ) : (
            <div className="surface-paper">
              {sortedProjects.map((project, index) => (
                <article
                  key={project.id}
                  className={[
                    'project-row flex items-center gap-4 px-4 py-3',
                    index > 0 ? 'border-t border-neutral-100' : '',
                    openProjectMenuId === project.id ? 'bg-canvas-shell' : 'hover:bg-canvas-shell',
                  ].join(' ')}
                >
                  <div
                    className="flex-shrink-0 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <ImageFrame
                      entityType="project"
                      entityId={project.id}
                      alt={project.name}
                      className="h-16 w-24 object-cover"
                    />
                  </div>

                  <Link
                    to={`/projects/${project.id}/snapshot`}
                    className="flex min-w-0 flex-1 items-center gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    aria-label={`Open ${project.name} snapshot`}
                  >
                    <div className="min-w-0 flex-1">
                      {project.clientName && (
                        <p className="eyebrow text-brand-600">{project.clientName}</p>
                      )}
                      <h3 className="mt-0.5 truncate font-display text-lg font-semibold leading-snug text-neutral-950">
                        {project.name}
                      </h3>
                      <p className="mt-0.5 truncate text-sm text-neutral-500">
                        {[
                          project.companyName,
                          project.projectLocation,
                          `Updated ${formatRelativeDate(project.updatedAt)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </Link>

                  <div
                    className="flex flex-shrink-0 items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <ProjectOptionsMenu
                      projectId={project.id}
                      projectName={project.name}
                      open={openProjectMenuId === project.id}
                      onToggle={() =>
                        setOpenProjectMenuId((cur) => (cur === project.id ? null : project.id))
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

function formatRelativeDate(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
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

function ProjectListSkeleton() {
  return (
    <div className="surface-paper">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={[
            'flex items-center gap-4 px-4 py-3',
            i > 0 ? 'border-t border-neutral-100' : '',
          ].join(' ')}
        >
          <div className="h-16 w-24 flex-shrink-0 animate-pulse bg-canvas-shell" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-20 animate-pulse bg-canvas-shell" />
            <div className="h-4 w-48 animate-pulse bg-canvas-shell" />
            <div className="h-3 w-32 animate-pulse bg-canvas-shell" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-14 animate-pulse rounded-sm bg-canvas-shell" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoProjectsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center border-y border-dashed border-neutral-200 px-6 py-16 text-center">
      <div className="flex max-w-sm flex-col items-center gap-5">
        <svg aria-hidden="true" viewBox="0 0 220 160" className="h-28 w-40 opacity-70">
          <rect
            x="38"
            y="36"
            width="132"
            height="92"
            fill="rgb(var(--color-canvas-chrome))"
            stroke="rgb(var(--color-brand-700) / 0.25)"
            strokeWidth="1.5"
          />
          <path
            d="M62 62h84M62 82h64M62 102h76"
            stroke="rgb(var(--color-brand-600))"
            strokeWidth="5"
            strokeLinecap="square"
          />
          <path
            d="M154 46h20M164 36v20"
            stroke="rgb(var(--color-brand-600))"
            strokeWidth="5"
            strokeLinecap="square"
          />
        </svg>
        <div>
          <h2 className="font-display text-xl font-semibold text-neutral-950">No projects yet</h2>
          <p className="mt-1.5 text-sm text-neutral-500">
            Create your first project to start building FF&amp;E and proposal deliverables.
          </p>
        </div>
        <Button type="button" variant="primary" size="md" onClick={onCreate}>
          <PlusIcon />
          Create your first project
        </Button>
      </div>
    </div>
  );
}
