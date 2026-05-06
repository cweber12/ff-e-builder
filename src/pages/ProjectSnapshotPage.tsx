import { Link } from 'react-router-dom';
import {
  cents,
  formatMoney,
  type Project,
  type ProposalCategoryWithItems,
  type RoomWithItems,
} from '../types';

type ProjectSnapshotPageProps = {
  project: Project;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
};

export function ProjectSnapshotPage({
  project,
  roomsWithItems,
  proposalCategoriesWithItems,
}: ProjectSnapshotPageProps) {
  const roomCount = roomsWithItems.length;
  const ffeItemCount = roomsWithItems.reduce((sum, room) => sum + room.items.length, 0);
  const proposalCategoryCount = proposalCategoriesWithItems.length;
  const proposalItemCount = proposalCategoriesWithItems.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Project Snapshot
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-gray-950">{project.name}</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          This overview is now the default project landing page. We&apos;ll build it out next with
          budget, finish library, and attention-needed summaries for project managers.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-950">Project Summary</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SnapshotMetric label="Client" value={project.clientName || 'Not set'} />
            <SnapshotMetric label="Company" value={project.companyName || 'Not set'} />
            <SnapshotMetric label="Location" value={project.projectLocation || 'Not set'} />
            <SnapshotMetric
              label="Budget Mode"
              value={project.budgetMode === 'individual' ? 'Split budgets' : 'Shared budget'}
            />
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-950">Quick Actions</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <SnapshotLink to={`/projects/${project.id}/ffe/table`} label="Open FF&E" />
            <SnapshotLink to={`/projects/${project.id}/proposal/table`} label="Open Proposal" />
            <SnapshotLink to={`/projects/${project.id}/materials`} label="Open Materials" />
            <SnapshotLink to={`/projects/${project.id}/budget`} label="Open Budget" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Budget"
          description="Combined project target"
          value={formatMoney(cents(project.budgetCents))}
          to={`/projects/${project.id}/budget`}
        />
        <SummaryCard
          title="FF&E"
          description={`${roomCount} rooms • ${ffeItemCount} items`}
          value={String(roomCount)}
          to={`/projects/${project.id}/ffe/table`}
        />
        <SummaryCard
          title="Proposal"
          description={`${proposalCategoryCount} categories • ${proposalItemCount} items`}
          value={String(proposalCategoryCount)}
          to={`/projects/${project.id}/proposal/table`}
        />
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  description,
  value,
  to,
}: {
  title: string;
  description: string;
  value: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <p className="text-sm font-semibold text-gray-950">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-gray-950">{value}</p>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </Link>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function SnapshotLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      {label}
    </Link>
  );
}
