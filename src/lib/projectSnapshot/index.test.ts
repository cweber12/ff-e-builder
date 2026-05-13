import { describe, expect, it } from 'vitest';
import type {
  ImageAsset,
  Material,
  Project,
  ProposalCategoryWithItems,
  RoomWithItems,
} from '../../types';
import {
  buildBudgetSummary,
  buildFfeSummary,
  buildMaterialsSummary,
  buildProjectSummary,
  buildProposalSummary,
  buildStatusBreakdown,
} from './index';

const project: Project = {
  id: 'project-1',
  ownerUid: 'uid-1',
  name: 'Sunset Tower',
  clientName: 'Avery Hart',
  companyName: 'Studio North',
  projectLocation: 'Los Angeles, CA',
  budgetMode: 'individual',
  budgetCents: 50_000_00,
  ffeBudgetCents: 20_000_00,
  proposalBudgetCents: 15_000_00,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2026-05-01T00:00:00Z',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-05T00:00:00Z',
};

const materials: Material[] = [
  {
    id: 'mat-1',
    projectId: 'project-1',
    name: 'Walnut',
    materialId: '100',
    description: '',
    swatchHex: '#654321',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'mat-2',
    projectId: 'project-1',
    name: 'Travertine',
    materialId: '101',
    description: '',
    swatchHex: '#cccccc',
    createdAt: '',
    updatedAt: '',
  },
];

const roomsWithItems: RoomWithItems[] = [
  {
    id: 'room-1',
    projectId: 'project-1',
    name: 'Lobby',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
    items: [
      {
        id: 'item-1',
        roomId: 'room-1',
        itemName: 'Sofa',
        description: null,
        category: null,
        itemIdTag: null,
        dimensions: null,
        notes: null,
        qty: 2,
        unitCostCents: 700_00,
        leadTime: null,
        status: 'pending',
        customData: {},
        sortOrder: 1,
        version: 1,
        createdAt: '',
        updatedAt: '',
        materials: [materials[0]!],
      },
      {
        id: 'item-2',
        roomId: 'room-1',
        itemName: 'Chair',
        description: null,
        category: null,
        itemIdTag: null,
        dimensions: null,
        notes: null,
        qty: 4,
        unitCostCents: 200_00,
        leadTime: null,
        status: 'pending',
        customData: {},
        sortOrder: 2,
        version: 1,
        createdAt: '',
        updatedAt: '',
        materials: [],
      },
    ],
  },
];

const proposalCategoriesWithItems: ProposalCategoryWithItems[] = [
  {
    id: 'category-1',
    projectId: 'project-1',
    name: 'Millwork',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
    items: [
      {
        id: 'proposal-1',
        categoryId: 'category-1',
        productTag: 'P-1',
        plan: '',
        drawings: '',
        location: '',
        description: '',
        notes: '',
        sizeLabel: '',
        sizeMode: 'imperial',
        sizeW: '',
        sizeD: '',
        sizeH: '',
        sizeUnit: 'ft/in',
        materials: [materials[1]!],
        cbm: 0,
        quantity: 2,
        quantityUnit: 'pcs',
        unitCostCents: 400_00,
        sortOrder: 1,
        version: 1,
        createdAt: '',
        updatedAt: '',
        costUpdateDeferred: false,
        customData: {},
      },
      {
        id: 'proposal-2',
        categoryId: 'category-1',
        productTag: 'P-2',
        plan: '',
        drawings: '',
        location: '',
        description: '',
        notes: '',
        sizeLabel: '',
        sizeMode: 'imperial',
        sizeW: '',
        sizeD: '',
        sizeH: '',
        sizeUnit: 'ft/in',
        materials: [],
        cbm: 0,
        quantity: 4,
        quantityUnit: 'pcs',
        unitCostCents: 250_00,
        sortOrder: 2,
        version: 1,
        createdAt: '',
        updatedAt: '',
        costUpdateDeferred: false,
        customData: {},
      },
      {
        id: 'proposal-3',
        categoryId: 'category-1',
        productTag: 'P-3',
        plan: '',
        drawings: '',
        location: '',
        description: '',
        notes: '',
        sizeLabel: '',
        sizeMode: 'imperial',
        sizeW: '',
        sizeD: '',
        sizeH: '',
        sizeUnit: 'ft/in',
        materials: [],
        cbm: 0,
        quantity: 1,
        quantityUnit: 'pcs',
        unitCostCents: 100_00,
        sortOrder: 3,
        version: 1,
        createdAt: '',
        updatedAt: '',
        costUpdateDeferred: false,
        customData: {},
      },
    ],
  },
];

const projectImages: ImageAsset[] = [
  {
    id: 'img-1',
    entityType: 'project',
    ownerUid: 'uid-1',
    projectId: 'project-1',
    roomId: null,
    itemId: null,
    materialId: null,
    proposalItemId: null,
    filename: 'cover.png',
    contentType: 'image/png',
    byteSize: 123,
    altText: 'Project cover',
    isPrimary: true,
    cropX: null,
    cropY: null,
    cropWidth: null,
    cropHeight: null,
    createdAt: '',
    updatedAt: '',
  },
];

describe('projectSnapshot helpers', () => {
  it('builds project summary metrics', () => {
    const summary = buildProjectSummary(project, projectImages);

    expect(summary.find((row) => row.label === 'Client')?.value).toBe('Avery Hart');
    expect(summary.find((row) => row.label === 'Project Images')?.value).toBe('1/3 uploaded');
  });

  it('builds budget and tool summaries', () => {
    const budget = buildBudgetSummary(project, roomsWithItems, proposalCategoriesWithItems);
    const ffe = buildFfeSummary(roomsWithItems);
    const proposal = buildProposalSummary(proposalCategoriesWithItems);

    expect(budget.ffeActualCents).toBeGreaterThan(0);
    expect(budget.proposalActualCents).toBeGreaterThan(0);
    expect(ffe.itemCount).toBe(2);
    expect(proposal.itemCount).toBe(3);
    expect(ffe.pendingCount).toBe(2);
    expect(proposal.totalCents).toBeGreaterThan(0);
  });

  it('builds material usage and status signals', () => {
    const materialsSummary = buildMaterialsSummary(
      materials,
      roomsWithItems,
      proposalCategoriesWithItems,
    );
    const statusBreakdown = buildStatusBreakdown(roomsWithItems);

    expect(materialsSummary.totalMaterials).toBe(2);
    expect(materialsSummary.usedInFfeCount).toBe(1);
    expect(materialsSummary.usedInProposalCount).toBe(1);
    expect(statusBreakdown.pending).toBe(2);
  });
});
