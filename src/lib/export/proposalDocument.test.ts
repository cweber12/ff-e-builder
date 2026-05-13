import { describe, expect, it } from 'vitest';
import {
  buildProposalExportDocument,
  filteredProposalCategories,
  proposalCompactIdentityLine,
  proposalSubtotalLabelColumnIndex,
  type ProposalAssetBundle,
} from './proposalDocument';
import type { Project, ProposalCategoryWithItems, ProposalItem } from '../../types';

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  ownerUid: 'u1',
  name: 'Hotel Lobby',
  clientName: 'Client Co.',
  companyName: 'Studio Co.',
  projectLocation: 'Los Angeles',
  budgetMode: 'individual',
  budgetCents: 200000,
  proposalBudgetCents: 150000,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeProposalItem = (overrides: Partial<ProposalItem> = {}): ProposalItem => ({
  id: 'pi1',
  categoryId: 'pc1',
  productTag: 'P-001',
  plan: '',
  drawings: 'A-101',
  location: 'Lobby',
  description: 'Custom lounge chair',
  notes: '',
  sizeLabel: '30"W x 32"D x 32"H',
  sizeMode: 'imperial',
  sizeW: '30',
  sizeD: '32',
  sizeH: '32',
  sizeUnit: 'ft/in',
  materials: [],
  cbm: 1.5,
  quantity: 2,
  quantityUnit: 'ea',
  unitCostCents: 25000,
  sortOrder: 0,
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  costUpdateDeferred: false,
  customData: {},
  ...overrides,
});

const makeCategory = (
  overrides: Partial<ProposalCategoryWithItems> = {},
): ProposalCategoryWithItems => ({
  id: 'pc1',
  projectId: 'p1',
  name: 'Loose Furniture',
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  items: [makeProposalItem()],
  ...overrides,
});

const makeAssets = (overrides: Partial<ProposalAssetBundle> = {}): ProposalAssetBundle => ({
  projectImages: [],
  renderingByItemId: new Map(),
  planByItemId: new Map(),
  swatchesByItemId: new Map(),
  ...overrides,
});

describe('proposal export document', () => {
  it('filters out empty categories', () => {
    const populated = makeCategory({ name: 'Populated' });
    const empty = makeCategory({ id: 'pc2', name: 'Empty', items: [] });

    expect(filteredProposalCategories([empty, populated])).toEqual([populated]);
  });

  it('builds identity lines, totals, and row values', () => {
    const item = makeProposalItem();
    const document = buildProposalExportDocument(
      makeProject(),
      [makeCategory({ items: [item] })],
      makeAssets(),
      {
        ownerUid: 'u1',
        name: 'Designer',
        email: 'designer@example.com',
        phone: '',
        companyName: '',
        createdAt: '',
        updatedAt: '',
        authorized: true,
      },
    );

    expect(document.companyName).toBe('Studio Co.');
    expect(document.projectLine).toBe('Hotel Lobby | Los Angeles');
    expect(document.preparedByLine).toBe('Designer | designer@example.com');
    expect(document.compactIdentityLine).toBe('Studio Co. | Hotel Lobby | Los Angeles');
    expect(document.grandTotalCents).toBe(50000);
    expect(document.budgetTargetCents).toBe(150000);
    expect(document.categories[0]?.quantityTotal).toBe(2);
    expect(document.categories[0]?.rows[0]?.values.totalCost).toBe('$500.00');
    expect(document.categories[0]?.rows[0]?.values.drawingsLocation).toBe('A-101\nLobby');
  });

  it('shows image columns only when assets exist', () => {
    const item = makeProposalItem({ id: 'pi-with-assets', plan: 'Plan note' });
    const document = buildProposalExportDocument(
      makeProject(),
      [makeCategory({ items: [item] })],
      makeAssets({
        renderingByItemId: new Map([[item.id, 'rendering']]),
        planByItemId: new Map([[item.id, 'plan']]),
        swatchesByItemId: new Map([[item.id, ['swatch']]]),
      }),
    );

    expect(document.columns.map((column) => column.key)).toEqual([
      'rendering',
      'productTag',
      'plan',
      'drawingsLocation',
      'description',
      'size',
      'swatch',
      'cbm',
      'quantity',
      'unit',
      'unitCost',
      'totalCost',
    ]);
  });

  it('uses the fallback company name in compact identity lines', () => {
    expect(proposalCompactIdentityLine(makeProject({ companyName: '', projectLocation: '' }))).toBe(
      'ChillDesignStudio | Hotel Lobby',
    );
  });

  it('chooses the first preferred subtotal label column', () => {
    const document = buildProposalExportDocument(makeProject(), [makeCategory()], makeAssets());

    expect(document.columns[proposalSubtotalLabelColumnIndex(document.columns)]?.key).toBe(
      'description',
    );
  });
});
