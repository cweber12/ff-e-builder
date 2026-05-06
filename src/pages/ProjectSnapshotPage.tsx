import { BudgetSnapshotCard } from '../components/project/BudgetSnapshotCard';
import { FinishLibrarySnapshotCard } from '../components/project/FinishLibrarySnapshotCard';
import { ProjectSummaryCard } from '../components/project/ProjectSummaryCard';
import { ToolSnapshotCard } from '../components/project/ToolSnapshotCard';
import { useImages, useMaterials } from '../hooks';
import {
  buildFfeSummary,
  buildMaterialsSummary,
  buildProposalSummary,
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
  const { data: projectImages = [] } = useImages('project', project.id);
  const { data: materials = [], isLoading: materialsLoading } = useMaterials(project.id);
  const ffeSummary = buildFfeSummary(roomsWithItems);
  const proposalSummary = buildProposalSummary(proposalCategoriesWithItems);
  const materialsSummary = buildMaterialsSummary(
    materials,
    roomsWithItems,
    proposalCategoriesWithItems,
  );
  const proposalQuantityTotal = proposalCategoriesWithItems.reduce(
    (sum, category) => sum + category.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <ProjectSummaryCard project={project} projectImages={projectImages} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetSnapshotCard
          project={project}
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
        />
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
        />
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
        <FinishLibrarySnapshotCard
          projectId={project.id}
          summary={materialsSummary}
          isLoading={materialsLoading}
        />
      </div>
    </div>
  );
}
