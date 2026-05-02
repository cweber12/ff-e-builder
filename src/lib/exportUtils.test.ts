import { describe, expect, it, vi, beforeEach } from 'vitest';
import { safeName, exportTableCsv, exportSummaryCsv } from './exportUtils';
import type { Project } from '../types';
import type { RoomWithItems } from '../types';
import type { Item } from '../types/item';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockObjectUrl = 'blob:mock-url';
let capturedBlobContent = '';
let downloadedFilename = '';

beforeEach(() => {
  capturedBlobContent = '';
  downloadedFilename = '';

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
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'i1',
  roomId: 'r1',
  itemName: 'Test Chair',
  category: 'Seating',
  vendor: 'Herman Miller',
  model: 'Aeron',
  itemIdTag: 'LR-001',
  dimensions: '26"W',
  seatHeight: null,
  finishes: null,
  notes: null,
  qty: 2,
  unitCostCents: 50000,
  markupPct: 25,
  leadTime: '8 weeks',
  status: 'pending',
  imageUrl: null,
  linkUrl: null,
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

// ─── exportTableCsv ──────────────────────────────────────────────────────────

describe('exportTableCsv', () => {
  it('triggers a download with a .csv filename', () => {
    exportTableCsv(makeProject(), [makeRoom()]);
    expect(downloadedFilename).toMatch(/\.csv$/);
  });

  it('uses project name in the filename', () => {
    exportTableCsv(makeProject({ name: 'My Project' }), [makeRoom()]);
    expect(downloadedFilename).toContain('my-project');
  });

  it('appends room name to filename when filterRoom is provided', () => {
    const room = makeRoom({ name: 'Living Room' });
    exportTableCsv(makeProject(), [room], room);
    expect(downloadedFilename).toContain('living-room');
  });

  it('creates a CSV blob with correct headers', () => {
    exportTableCsv(makeProject(), [makeRoom()]);
    expect(capturedBlobContent).toContain('Item Name');
    expect(capturedBlobContent).toContain('Vendor');
    expect(capturedBlobContent).toContain('Unit Cost');
  });

  it('includes item data in CSV rows', () => {
    const item = makeItem({ itemName: 'Lounge Sofa', vendor: 'Knoll' });
    exportTableCsv(makeProject(), [makeRoom({ items: [item] })]);
    expect(capturedBlobContent).toContain('Lounge Sofa');
    expect(capturedBlobContent).toContain('Knoll');
  });

  it('handles empty rooms gracefully', () => {
    exportTableCsv(makeProject(), [makeRoom({ items: [] })]);
    expect(capturedBlobContent).toContain('Item Name');
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
