import { BudgetSnapshotCard } from '../components/project/BudgetSnapshotCard';
import { FinishLibrarySnapshotCard } from '../components/project/FinishLibrarySnapshotCard';
import { ProjectSummaryCard } from '../components/project/ProjectSummaryCard';
import { ToolSnapshotCard } from '../components/project/ToolSnapshotCard';
import { useMaterials } from '../hooks';
import {
  buildFfeSummary,
  buildMaterialsSummary,
  buildProposalSummary,
  buildStatusBreakdown,
} from '../lib/projectSnapshot';
import type { ProposalCategoryWithItems, Project, RoomWithItems } from '../types';

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
  const { data: materials = [], isLoading: materialsLoading } = useMaterials(project.id);
  const ffeSummary = buildFfeSummary(roomsWithItems);
  const proposalSummary = buildProposalSummary(proposalCategoriesWithItems);
  const materialsSummary = buildMaterialsSummary(
    materials,
    roomsWithItems,
    proposalCategoriesWithItems,
  );
  const statusBreakdown = buildStatusBreakdown(roomsWithItems);
  const proposalQuantityTotal = proposalCategoriesWithItems.reduce(
    (sum, category) => sum + category.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  return (
    <div>
      <ProjectSummaryCard project={project} />

      <div className="border-t border-neutral-200" />
      <BudgetSnapshotCard
        project={project}
        roomsWithItems={roomsWithItems}
        proposalCategoriesWithItems={proposalCategoriesWithItems}
      />

      <div className="border-t border-neutral-200" />
      <div className="grid py-8 lg:grid-cols-2 lg:divide-x lg:divide-neutral-200">
        <div className="lg:pr-10">
          <ToolSnapshotCard
            title="FF&E Snapshot"
            summary={ffeSummary}
            to={`/projects/${project.id}/ffe/table`}
            count={roomsWithItems.length}
            countLabel="rooms"
            description="High-level FF&E progress"
            metrics={[
              { label: 'Items', value: String(ffeSummary.itemCount) },
              { label: 'Pending', value: String(ffeSummary.pendingCount ?? 0) },
            ]}
            statusBreakdown={statusBreakdown}
          />
        </div>
        <div className="border-t border-neutral-200 pt-8 lg:border-t-0 lg:pl-10 lg:pt-0">
          <ToolSnapshotCard
            title="Proposal Snapshot"
            summary={proposalSummary}
            to={`/projects/${project.id}/proposal/table`}
            count={proposalCategoriesWithItems.length}
            countLabel="categories"
            description="High-level proposal scope"
            metrics={[
              { label: 'Items', value: String(proposalSummary.itemCount) },
              { label: 'Quantity', value: String(proposalQuantityTotal) },
            ]}
          />
        </div>
      </div>

      <div className="border-t border-neutral-200" />
      <FinishLibrarySnapshotCard
        projectId={project.id}
        summary={materialsSummary}
        isLoading={materialsLoading}
      />
    </div>
  );
}
