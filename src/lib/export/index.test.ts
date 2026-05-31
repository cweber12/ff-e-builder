import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  safeName,
  exportSummaryCsv,
  exportProposalCsv,
  exportFinishesExcel,
  exportMaterialsExcel,
} from './index';
import {
  buildCatalogPdfPageModel,
  pickCatalogPdfOptionLayout,
  resolveCatalogPdfImageAlignment,
} from './ffe/catalogPdf';
import { resolveColorToken, type CatalogColorToken } from './ffe/catalogTokens';
import {
  buildProposalExportDocument,
  filteredProposalCategories,
  proposalSubtotalLabelColumnIndex,
  type ProposalAssetBundle,
} from './proposal/proposalDocument';
import type {
  Finish,
  Material,
  Project,
  ProposalCategoryWithItems,
  ProposalItem,
} from '../../types';
import type { RoomWithItems } from '../../types';
import type { Item } from '../../types/item';

const apiMocks = vi.hoisted(() => ({
  imagesList: vi.fn(() => Promise.resolve([])),
  getContentBlob: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    images: {
      list: apiMocks.imagesList,
      getContentBlob: apiMocks.getContentBlob,
    },
  },
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockObjectUrl = 'blob:mock-url';
let capturedBlobContent = '';
let downloadedFilename = '';

beforeEach(() => {
  capturedBlobContent = '';
  downloadedFilename = '';
  apiMocks.imagesList.mockResolvedValue([]);
  apiMocks.getContentBlob.mockReset();

  // Capture blob content at construction time (avoids Blob.text() jsdom compat issues)
  vi.spyOn(globalThis, 'Blob').mockImplementation((parts?: BlobPart[]) => {
    capturedBlobContent = (parts ?? []).map(String).join('');
    return { type: 'text/csv', size: capturedBlobContent.length } as Blob;
  });

  globalThis.URL.createObjectURL = vi.fn(() => mockObjectUrl);
  globalThis.URL.revokeObjectURL = vi.fn();

  const mockLink = {
    href: '',
    download: '',
    click: vi.fn(() => {
      downloadedFilename = mockLink.download;
    }),
  };
  vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
});

// ─── Factories ────────────────────────────────────────────────────────────────

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  ownerUid: 'u1',
  name: 'Test Project',
  clientName: 'Client Co.',
  budgetCents: 1000000,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'i1',
  roomId: 'r1',
  itemName: 'Test Chair',
  description: null,
  category: 'Seating',
  itemIdTag: 'LR-001',
  dimensions: '26"W',
  notes: null,
  qty: 2,
  unitCostCents: 50000,
  leadTime: '8 weeks',
  status: 'pending',
  customData: {},
  sortOrder: 0,
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  materials: [],
  ...overrides,
});

const makeRoom = (overrides: Partial<RoomWithItems> = {}): RoomWithItems => ({
  id: 'r1',
  projectId: 'p1',
  name: 'Living Room',
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  items: [makeItem()],
  ...overrides,
});

const makeProposalItem = (overrides: Partial<ProposalItem> = {}): ProposalItem => ({
  id: 'pi1',
  categoryId: 'pc1',
  productTag: 'P-001',
  itemName: 'Custom lounge chair',
  plan: '',
  drawings: 'A-101',
  location: 'Living Room',
  description: 'Custom lounge chair',
  notes: '',
  sizeLabel: '30"W x 32"D x 32"H',
  sizeMode: 'imperial',
  sizeW: '30',
  sizeD: '32',
  sizeH: '32',
  sizeUnit: 'ft/in',
  footprintLabel: '',
  footprintW: '',
  footprintD: '',
  footprintUnit: '',
  footprintArea: null,
  materials: [
    {
      id: 'm1',
      projectId: 'p1',
      name: 'Walnut',
      materialId: 'MAT-001',
      code: '',
      finishId: null,
      materialType: null,
      description: '',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
  cbm: 1.5,
  quantity: 2,
  quantityUnit: 'ea',
  unitCostCents: 25000,
  sortOrder: 0,
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  customData: {},
  ...overrides,
});

const makeProposalCategory = (
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

const makeMaterial = (overrides: Partial<Material> = {}): Material => ({
  id: 'm1',
  projectId: 'p1',
  name: 'Walnut',
  materialId: 'MAT-001',
  code: '',
  finishId: null,
  materialType: null,
  description: 'Wood finish',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeFinish = (overrides: Partial<Finish> = {}): Finish => ({
  id: 'f1',
  projectId: 'p1',
  code: 'FIN-001',
  name: 'Walnut',
  category: 'wood',
  subCategory: 'Rift sawn',
  description: 'Warm walnut finish',
  manufacturer: 'Acme',
  sourceUrl: 'https://example.com/walnut',
  swatchHex: '#7A4A2B',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeProposalAssets = (overrides: Partial<ProposalAssetBundle> = {}): ProposalAssetBundle => ({
  projectImages: [],
  renderingByItemId: new Map(),
  planByItemId: new Map(),
  swatchesByItemId: new Map(),
  ...overrides,
});

// ─── safeName ─────────────────────────────────────────────────────────────────

describe('safeName', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(safeName('My Project Name')).toBe('my-project-name');
  });

  it('removes special characters', () => {
    expect(safeName('Project: "FF&E" 2024!')).toBe('project-ff-e-2024');
  });

  it('trims leading and trailing hyphens', () => {
    expect(safeName('  project  ')).toBe('project');
  });

  it('collapses multiple separators into one hyphen', () => {
    expect(safeName('project--name')).toBe('project-name');
  });
});

// ─── exportSummaryCsv ────────────────────────────────────────────────────────

describe('exportSummaryCsv', () => {
  it('triggers a download with summary in filename', () => {
    exportSummaryCsv(makeProject(), [makeRoom()]);
    expect(downloadedFilename).toContain('summary');
  });

  it('creates a CSV blob with budget and rooms data', () => {
    const project = makeProject({ budgetCents: 500000 });
    exportSummaryCsv(project, [makeRoom()]);
    expect(capturedBlobContent).toContain('Budget');
    expect(capturedBlobContent).toContain('Rooms');
  });

  it('includes status breakdown', () => {
    const item = makeItem({ status: 'ordered' });
    exportSummaryCsv(makeProject(), [makeRoom({ items: [item] })]);
    expect(capturedBlobContent).toContain('ordered');
  });
});

describe('exportProposalCsv', () => {
  it('exports proposal headers and row data', () => {
    exportProposalCsv(makeProject(), [makeProposalCategory()]);

    expect(downloadedFilename).toBe('test-project-proposal.csv');
    expect(capturedBlobContent).toContain('Product Tag');
    expect(capturedBlobContent).toContain('P-001');
    expect(capturedBlobContent).toContain('Loose Furniture');
    expect(capturedBlobContent).toContain('Walnut');
    expect(capturedBlobContent).toContain('$500.00');
  });
});

describe('proposal export document preparation', () => {
  it('filters empty proposal categories before export', () => {
    const populated = makeProposalCategory({ name: 'Populated' });
    const empty = makeProposalCategory({ id: 'pc2', name: 'Empty', items: [] });

    expect(filteredProposalCategories([empty, populated])).toEqual([populated]);
  });

  it('builds a proposal document with totals, identity lines, and visible asset columns', () => {
    const item = makeProposalItem({ id: 'pi-with-assets', plan: 'Plan note' });
    const category = makeProposalCategory({ items: [item] });
    const assets = makeProposalAssets({
      projectImages: ['data:image/png;base64,project'],
      renderingByItemId: new Map([[item.id, 'data:image/png;base64,rendering']]),
      planByItemId: new Map([[item.id, 'data:image/png;base64,plan']]),
      swatchesByItemId: new Map([
        [item.id, [{ name: 'Walnut', image: 'data:image/png;base64,swatch' }]],
      ]),
    });

    const document = buildProposalExportDocument(
      makeProject({
        companyName: 'Studio Co.',
        projectLocation: 'Los Angeles',
        budgetMode: 'individual',
        proposalBudgetCents: 100000,
      }),
      [category],
      assets,
      {
        ownerUid: 'u1',
        name: 'Designer',
        email: 'designer@example.com',
        phone: '',
        createdAt: '',
        updatedAt: '',
        authorized: true,
      },
    );

    expect(document.companyName).toBe('Studio Co.');
    expect(document.projectLine).toBe('Test Project | Los Angeles');
    expect(document.preparedByLine).toBe('Designer | designer@example.com');
    expect(document.budgetTargetCents).toBe(100000);
    expect(document.grandTotalCents).toBe(50000);
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

  it('chooses the first available subtotal label column in proposal exports', () => {
    const document = buildProposalExportDocument(
      makeProject(),
      [makeProposalCategory()],
      makeProposalAssets(),
    );

    expect(document.columns[proposalSubtotalLabelColumnIndex(document.columns)]?.key).toBe(
      'description',
    );
  });
});

describe('exportMaterialsExcel', () => {
  it('exports material rows as CSV when requested', () => {
    exportMaterialsExcel(makeProject(), [makeMaterial()], 'csv');

    expect(downloadedFilename).toBe('test-project-materials.csv');
    expect(capturedBlobContent).toContain('"Manufacturer Ref"');
    expect(capturedBlobContent).toContain('Walnut');
    expect(capturedBlobContent).toContain('MAT-001');
  });
});

describe('exportFinishesExcel', () => {
  it('exports finish rows as CSV with expected headers and mapped row values', () => {
    exportFinishesExcel(makeProject(), [makeFinish()], 'csv');

    expect(downloadedFilename).toBe('test-project-finishes.csv');
    expect(capturedBlobContent).toContain(
      '"Code","Name","Category","Sub-Category","Manufacturer","Source URL","Swatch Color","Description"',
    );
    expect(capturedBlobContent).toContain('FIN-001');
    expect(capturedBlobContent).toContain('Walnut');
    expect(capturedBlobContent).toContain('Wood');
    expect(capturedBlobContent).toContain('Rift sawn');
    expect(capturedBlobContent).toContain('https://example.com/walnut');
    expect(capturedBlobContent).toContain('#7A4A2B');
  });
});

describe('catalog PDF page model', () => {
  it('omits blank strings, empty options, and zero cost values', () => {
    const model = buildCatalogPdfPageModel(
      makeItem({
        itemIdTag: '   ',
        dimensions: '',
        description: '  ',
        notes: '\n',
        unitCostCents: 0,
      }),
      [{ dataUrl: null }, { dataUrl: '   ' }],
    );

    expect(model.itemIdTag).toBeNull();
    expect(model.dimensions).toBeNull();
    expect(model.description).toBeNull();
    expect(model.notes).toBeNull();
    expect(model.unitCostCents).toBeNull();
    expect(model.optionCount).toBe(0);
  });

  it('preserves populated catalog values that should render in the PDF', () => {
    const material = makeMaterial({ name: 'Ivory boucle' });
    const model = buildCatalogPdfPageModel(
      makeItem({
        itemIdTag: 'LR-CH-01',
        dimensions: '32"W x 34"D x 30"H',
        description: 'Sculpted lounge chair',
        notes: 'Confirm COM yardage.',
        unitCostCents: 245000,
        materials: [material],
      }),
      [{ dataUrl: 'data:image/png;base64,option-1' }, { dataUrl: null }],
    );

    expect(model.itemIdTag).toBe('LR-CH-01');
    expect(model.dimensions).toBe('32"W x 34"D x 30"H');
    expect(model.description).toBe('Sculpted lounge chair');
    expect(model.notes).toBe('Confirm COM yardage.');
    expect(model.unitCostCents).toBe(245000);
    expect(model.optionCount).toBe(1);
    expect(model.materials).toEqual([material]);
  });

  it('keeps a single option centered as a standalone card', () => {
    expect(pickCatalogPdfOptionLayout(1, [], 90)).toBe('stacked');
  });

  it('renders two option images in a horizontal two-up row', () => {
    expect(pickCatalogPdfOptionLayout(2, [makeMaterial()], 60)).toBe('row');
  });

  it('defaults catalog PDF image alignment to center and preserves top when requested', () => {
    expect(resolveCatalogPdfImageAlignment(undefined)).toBe('center');
    expect(resolveCatalogPdfImageAlignment(null)).toBe('center');
    expect(resolveCatalogPdfImageAlignment('top')).toBe('top');
  });
});

// ─── catalog PDF color tokens (regression for #67 typography parity) ──────────
describe('catalog PDF color token resolution', () => {
  it('maps ink-950 to near-black matching the browser token', () => {
    expect(resolveColorToken('ink-950')).toEqual([10, 10, 10]);
  });

  it('maps ink-800 to dark gray matching the browser token', () => {
    expect(resolveColorToken('ink-800')).toEqual([38, 38, 38]);
  });

  it('maps slate-700 to the same value as the browser #374151', () => {
    expect(resolveColorToken('slate-700')).toEqual([55, 65, 81]);
  });

  it('resolves all three tokens to distinct RGB values', () => {
    const tokens: CatalogColorToken[] = ['ink-950', 'ink-800', 'slate-700'];
    const colors = tokens.map(resolveColorToken);
    const serialised = colors.map((c) => c.join(','));
    expect(new Set(serialised).size).toBe(3);
  });
});
