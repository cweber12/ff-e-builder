import {
  itemStatuses,
  type ImageAsset,
  type ItemStatus,
  type Material,
  type Project,
  type ProposalCategoryWithItems,
  type RoomWithItems,
} from '../types';
import { projectTotalCents, proposalProjectTotalCents } from './budgetCalc';

export type SnapshotMetricRow = {
  label: string;
  value: string;
};

export type SnapshotBudgetSummary = {
  combinedActualCents: number;
  combinedBudgetCents: number;
  combinedPercent: number;
  ffeActualCents: number;
  ffeBudgetCents: number;
  ffePercent: number;
  proposalActualCents: number;
  proposalBudgetCents: number;
  proposalPercent: number;
};

export type SnapshotToolSummary = {
  itemCount: number;
  totalCents: number;
  pendingCount?: number;
};

export type SnapshotMaterialsSummary = {
  totalMaterials: number;
  usedInFfeCount: number;
  usedInProposalCount: number;
  unusedCount: number;
};

export function buildProjectSummary(
  project: Project,
  projectImages: ImageAsset[],
): SnapshotMetricRow[] {
  return [
    { label: 'Client', value: project.clientName || 'Not set' },
    { label: 'Company', value: project.companyName || 'Not set' },
    { label: 'Location', value: project.projectLocation || 'Not set' },
    {
      label: 'Budget Mode',
      value: project.budgetMode === 'individual' ? 'Split budgets' : 'Shared budget',
    },
    { label: 'Project Images', value: `${projectImages.length}/3 uploaded` },
    { label: 'Last Updated', value: formatAbsoluteDate(project.updatedAt) },
  ];
}

export function buildBudgetSummary(
  project: Project,
  roomsWithItems: RoomWithItems[],
  proposalCategoriesWithItems: ProposalCategoryWithItems[],
): SnapshotBudgetSummary {
  const isIndividual = project.budgetMode === 'individual';
  const ffeActualCents = projectTotalCents(roomsWithItems);
  const proposalActualCents = proposalProjectTotalCents(proposalCategoriesWithItems);
  const combinedActualCents = ffeActualCents + proposalActualCents;
  const ffeBudgetCents = isIndividual ? (project.ffeBudgetCents ?? 0) : project.budgetCents;
  const proposalBudgetCents = isIndividual
    ? (project.proposalBudgetCents ?? 0)
    : project.budgetCents;
  const combinedBudgetCents = isIndividual
    ? (project.ffeBudgetCents ?? 0) + (project.proposalBudgetCents ?? 0)
    : project.budgetCents;

  return {
    combinedActualCents,
    combinedBudgetCents,
    combinedPercent: percentOfBudget(combinedActualCents, combinedBudgetCents),
    ffeActualCents,
    ffeBudgetCents,
    ffePercent: percentOfBudget(ffeActualCents, ffeBudgetCents),
    proposalActualCents,
    proposalBudgetCents,
    proposalPercent: percentOfBudget(proposalActualCents, proposalBudgetCents),
  };
}

export function buildFfeSummary(roomsWithItems: RoomWithItems[]): SnapshotToolSummary {
  return {
    itemCount: roomsWithItems.reduce((sum, room) => sum + room.items.length, 0),
    totalCents: projectTotalCents(roomsWithItems),
    pendingCount: buildStatusBreakdown(roomsWithItems).pending,
  };
}

export function buildProposalSummary(
  proposalCategoriesWithItems: ProposalCategoryWithItems[],
): SnapshotToolSummary {
  return {
    itemCount: proposalCategoriesWithItems.reduce(
      (sum, category) => sum + category.items.length,
      0,
    ),
    totalCents: proposalProjectTotalCents(proposalCategoriesWithItems),
  };
}

export function buildMaterialsSummary(
  materials: Material[],
  roomsWithItems: RoomWithItems[],
  proposalCategoriesWithItems: ProposalCategoryWithItems[],
): SnapshotMaterialsSummary {
  const ffeIds = new Set(
    roomsWithItems.flatMap((room) =>
      room.items.flatMap((item) => item.materials.map((material) => material.id)),
    ),
  );
  const proposalIds = new Set(
    proposalCategoriesWithItems.flatMap((category) =>
      category.items.flatMap((item) => item.materials.map((material) => material.id)),
    ),
  );
  const usedIds = new Set([...ffeIds, ...proposalIds]);

  return {
    totalMaterials: materials.length,
    usedInFfeCount: ffeIds.size,
    usedInProposalCount: proposalIds.size,
    unusedCount: materials.filter((material) => !usedIds.has(material.id)).length,
  };
}

export function buildStatusBreakdown(roomsWithItems: RoomWithItems[]): Record<ItemStatus, number> {
  return Object.fromEntries(
    itemStatuses.map((status) => [
      status,
      roomsWithItems.reduce(
        (count, room) => count + room.items.filter((item) => item.status === status).length,
        0,
      ),
    ]),
  ) as Record<ItemStatus, number>;
}

function percentOfBudget(actualCents: number, budgetCents: number): number {
  if (budgetCents <= 0) return 0;
  return Math.min(Math.round((actualCents / budgetCents) * 100), 999);
}

function formatAbsoluteDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
