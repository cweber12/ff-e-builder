import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { FfeTable } from './FfeTable';
import { roomSubtotalCents, projectTotalCents } from '../../../lib/money';
import { getSortOrderPatches } from '../../../lib/items';
import { cents, formatMoney, type Item, type Room, type RoomWithItems } from '../../../types';

const {
  mockUpdateMutateAsync,
  mockCreateItemMutateAsync,
  mockDeleteItemMutateAsync,
  mockMoveItemMutateAsync,
  mockCreateRoomMutateAsync,
  mockDeleteRoomMutateAsync,
  mockCreateAndAssignMaterialMutateAsync,
  mockProposalRevisionsData,
} = vi.hoisted(() => ({
  mockUpdateMutateAsync: vi.fn(),
  mockCreateItemMutateAsync: vi.fn(),
  mockDeleteItemMutateAsync: vi.fn(),
  mockMoveItemMutateAsync: vi.fn(),
  mockCreateRoomMutateAsync: vi.fn(),
  mockDeleteRoomMutateAsync: vi.fn(),
  mockCreateAndAssignMaterialMutateAsync: vi.fn(),
  mockProposalRevisionsData: {
    revisions: [] as unknown[],
    snapshots: [] as unknown[],
    changelog: [] as unknown[],
  },
}));

vi.mock('../../../hooks', () => ({
  useUpdateItem: () => ({ mutateAsync: mockUpdateMutateAsync }),
  useCreateItem: () => ({ mutateAsync: mockCreateItemMutateAsync }),
  useDeleteItem: () => ({ mutateAsync: mockDeleteItemMutateAsync }),
  useMoveItem: () => ({ mutateAsync: mockMoveItemMutateAsync }),
  useCreateRoom: () => ({ mutateAsync: mockCreateRoomMutateAsync }),
  useDeleteRoom: () => ({ mutateAsync: mockDeleteRoomMutateAsync }),
  useUpdateRoom: () => ({ mutateAsync: vi.fn() }),
  useMaterials: () => ({ data: [], isLoading: false }),
  useCreateMaterial: () => ({ mutateAsync: vi.fn() }),
  useUpdateMaterial: () => ({ mutateAsync: vi.fn() }),
  useDeleteMaterial: () => ({ mutateAsync: vi.fn() }),
  useItemMaterialActions: () => ({
    assign: { mutateAsync: vi.fn() },
    createAndAssign: { mutateAsync: mockCreateAndAssignMaterialMutateAsync },
    remove: { mutateAsync: vi.fn() },
    update: { mutateAsync: vi.fn() },
  }),
  useImages: () => ({ data: [], isLoading: false }),
  useUploadImage: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteImage: () => ({ mutate: vi.fn(), isPending: false }),
  useSetPrimaryImage: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateImageCrop: () => ({ mutate: vi.fn(), isPending: false }),
  useItemColumnDefs: () => ({ data: [], isLoading: false }),
  useCreateItemColumnDef: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateItemColumnDef: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteItemColumnDef: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useColumnConfig: () => ({
    visibleOrder: [
      'drag',
      'image',
      'plan',
      'itemIdTag',
      'itemName',
      'description',
      'category',
      'dimensions',
      'materials',
      'qty',
      'unitCostCents',
      'lineTotal',
      'status',
      'leadTime',
      'notes',
      'actions',
    ],
    hiddenDefaults: [],
    moveColumn: vi.fn(),
    hideDefaultColumn: vi.fn(),
    restoreDefaultColumn: vi.fn(),
    addCustomColumn: vi.fn(),
    removeCustomColumn: vi.fn(),
  }),
  useIsMobileViewport: () => false,
  isPersistedImageEntityId: () => true,
  useTableDensity: () => ({ density: 'default', setDensity: vi.fn() }),
  densityRowClass: () => 'h-13',
  useProposalRevisions: () => ({
    data: mockProposalRevisionsData,
    isLoading: false,
  }),
}));

vi.mock('../../../lib/export', () => ({
  exportTableCsv: vi.fn(),
  exportTableExcel: vi.fn(),
  exportTablePdf: vi.fn(),
}));

vi.mock('../../ffe/import/ImportExcelModal', () => ({
  ImportExcelModal: () => null,
}));

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 'room-1',
  projectId: 'project-1',
  name: 'Living Room',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  roomId: 'room-1',
  itemName: 'Lounge Chair',
  description: null,
  category: 'Seating',
  itemIdTag: 'CH-01',
  dimensions: '28 x 30 x 31',
  notes: 'COM approved',
  qty: 2,
  unitCostCents: 123_456,
  leadTime: '8 weeks',
  status: 'approved',
  customData: {},
  sortOrder: 0,
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  materials: [],
  ...overrides,
});

const fixture: RoomWithItems[] = [
  {
    ...makeRoom({ id: 'room-1', name: 'Living Room', sortOrder: 0 }),
    items: [
      makeItem({
        id: 'item-1',
        roomId: 'room-1',
        itemName: 'Lounge Chair',
        unitCostCents: 123_456,
        qty: 2,
      }),
      makeItem({
        id: 'item-2',
        roomId: 'room-1',
        itemName: 'Floor Lamp',
        category: 'Lighting',
        itemIdTag: 'LT-01',
        unitCostCents: 45_000,
        qty: 1,
        status: 'ordered',
        sortOrder: 1,
      }),
    ],
  },
  {
    ...makeRoom({ id: 'room-2', name: 'Dining Room', sortOrder: 1 }),
    items: [
      makeItem({
        id: 'item-3',
        roomId: 'room-2',
        itemName: 'Dining Table',
        category: 'Casegoods',
        itemIdTag: 'TB-01',
        unitCostCents: 250_000,
        qty: 1,
        status: 'pending',
      }),
    ],
  },
  {
    ...makeRoom({ id: 'room-3', name: 'Guest Suite', sortOrder: 2 }),
    items: [],
  },
];

function renderTable(roomsWithItems = fixture) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FfeTable roomsWithItems={roomsWithItems} projectId="project-1" />
    </QueryClientProvider>,
  );
}

async function openLivingRoomActions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open options for Living Room' }));
}

async function openLivingRoomAddItem(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open options for Living Room' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add item' }));
}

describe('FfeTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMutateAsync.mockResolvedValue(makeItem());
    mockCreateItemMutateAsync.mockResolvedValue(makeItem({ id: 'item-created' }));
    mockDeleteItemMutateAsync.mockResolvedValue(undefined);
    mockMoveItemMutateAsync.mockResolvedValue(makeItem({ roomId: 'room-2' }));
    mockCreateRoomMutateAsync.mockResolvedValue(makeRoom({ id: 'room-created' }));
    mockDeleteRoomMutateAsync.mockResolvedValue(undefined);
    mockCreateAndAssignMaterialMutateAsync.mockResolvedValue({
      id: 'material-created',
      projectId: 'project-1',
      name: 'Ivory boucle',
      materialId: 'FAB-001',
      description: '',
      swatchHex: '#e8e2d6',
      swatches: ['#e8e2d6'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    mockProposalRevisionsData.revisions = [];
    mockProposalRevisionsData.snapshots = [];
    mockProposalRevisionsData.changelog = [];
    window.localStorage.clear();
  });

  it('renders all rooms and items from a fixture', () => {
    renderTable();

    expect(screen.getByText('Living Room')).toBeInTheDocument();
    expect(screen.getByText('Dining Room')).toBeInTheDocument();
    expect(screen.getByText('Guest Suite')).toBeInTheDocument();
    expect(screen.getByText('Lounge Chair')).toBeInTheDocument();
    expect(screen.getByText('Floor Lamp')).toBeInTheDocument();
    expect(screen.getByText('Dining Table')).toBeInTheDocument();
    expect(screen.getByText('No items — add one via the location menu.')).toBeInTheDocument();
  });

  it('shows linked proposal revision indicators in FF&E cells', () => {
    mockProposalRevisionsData.revisions = [
      {
        id: 'revision-1',
        projectId: 'project-1',
        revisionMajor: 1,
        revisionMinor: 0,
        label: '1.0',
        triggeredAtStatus: 'pricing_complete',
        openedAt: '2026-05-01T00:00:00Z',
        closedAt: null,
      },
    ];
    mockProposalRevisionsData.changelog = [
      {
        id: 'change-1',
        proposalItemId: 'proposal-item-1',
        generatedItemId: 'item-1',
        columnKey: 'quantity',
        previousValue: '1',
        newValue: '2',
        notes: 'Client added one chair',
        proposalStatus: 'pricing_complete',
        relatedChangeId: null,
        revisionId: 'revision-1',
        isPriceAffecting: true,
        changedAt: '2026-05-01T00:00:00Z',
      },
    ];

    renderTable();

    expect(
      screen.getAllByText('Revision 1.0 open - resolve costs in Proposal').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByTitle('View Proposal revision history').length).toBeGreaterThan(0);
  });

  it('renders room subtotals matching roomSubtotalCents', () => {
    renderTable();

    for (const room of fixture) {
      expect(
        screen.getAllByText(formatMoney(cents(roomSubtotalCents(room.items)))).length,
      ).toBeGreaterThan(0);
    }
  });

  it('renders a grand total matching projectTotalCents', () => {
    renderTable();

    expect(screen.getByText('Grand total')).toBeInTheDocument();
    expect(screen.getByText(formatMoney(cents(projectTotalCents(fixture))))).toBeInTheDocument();
  });

  it('formats money values for en-US currency display', () => {
    renderTable();

    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
    expect(screen.queryByText('123456')).not.toBeInTheDocument();
  });

  it('persists collapsed state across re-renders', async () => {
    const user = userEvent.setup();
    const { unmount } = renderTable();

    await user.click(screen.getByRole('button', { name: 'Collapse Living Room' }));

    expect(screen.queryByText('Lounge Chair')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('room:room-1:collapsed')).toBe('true');

    unmount();
    renderTable();

    expect(screen.queryByText('Lounge Chair')).not.toBeInTheDocument();
  });

  it('opens and closes an expanded room table view', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByRole('button', { name: 'Expand table view' })[0]!);

    expect(screen.getByLabelText('Living Room expanded items table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Minimize table view' }));
    expect(screen.queryByLabelText('Living Room expanded items table')).not.toBeInTheDocument();
  });

  it('renders five shimmer rows while loading', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FfeTable roomsWithItems={[]} projectId="project-1" isLoading />
      </QueryClientProvider>,
    );

    expect(screen.getAllByTestId('items-table-shimmer-row')).toHaveLength(5);
  });

  it('edits a money cell as dollars and submits cents', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.dblClick(screen.getByText('$1,234.56'));
    const input = screen.getByLabelText('Unit Cost for Lounge Chair');
    await user.clear(input);
    await user.type(input, '999.99');
    await user.tab();

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 'item-1',
      patch: { unitCostCents: 99_999, version: 1 },
    });
  });

  it('shows validation for a negative quantity and does not mutate', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.dblClick(screen.getByText('2'));
    const input = screen.getByLabelText('Quantity for Lounge Chair');
    await user.clear(input);
    await user.type(input, '-1');
    await user.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Invalid number');
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('cycles status pending to ordered to approved to received to pending', async () => {
    const user = userEvent.setup();
    const makeRoomsWithStatus = (status: Item['status'], version: number): RoomWithItems[] => [
      {
        ...makeRoom({ id: 'room-1', name: 'Living Room', sortOrder: 0 }),
        items: [makeItem({ id: 'item-1', status, version })],
      },
    ];
    let rooms = makeRoomsWithStatus('pending', 1);
    const tableForCurrentStatus = () => (
      <QueryClientProvider client={new QueryClient()}>
        <FfeTable key={rooms[0]!.items[0]!.status} roomsWithItems={rooms} projectId="project-1" />
      </QueryClientProvider>
    );

    const { rerender } = render(tableForCurrentStatus());

    await user.click(screen.getByRole('button', { name: /Pending/ }));
    expect(mockUpdateMutateAsync).toHaveBeenLastCalledWith({
      id: 'item-1',
      patch: { status: 'ordered', version: 1 },
    });

    rooms = makeRoomsWithStatus('ordered', 2);
    rerender(tableForCurrentStatus());

    await user.click(screen.getByRole('button', { name: /Ordered/ }));
    expect(mockUpdateMutateAsync).toHaveBeenLastCalledWith({
      id: 'item-1',
      patch: { status: 'approved', version: 2 },
    });

    rooms = makeRoomsWithStatus('approved', 3);
    rerender(tableForCurrentStatus());

    await user.click(screen.getByRole('button', { name: /Approved/ }));
    expect(mockUpdateMutateAsync).toHaveBeenLastCalledWith({
      id: 'item-1',
      patch: { status: 'received', version: 3 },
    });

    rooms = makeRoomsWithStatus('received', 4);
    rerender(tableForCurrentStatus());

    await user.click(screen.getByRole('button', { name: /Received/ }));
    expect(mockUpdateMutateAsync).toHaveBeenLastCalledWith({
      id: 'item-1',
      patch: { status: 'pending', version: 4 },
    });
  });

  it('adds an item via the drawer and submits every field to the API call', async () => {
    const user = userEvent.setup();
    renderTable();

    await openLivingRoomAddItem(user);
    const drawer = screen.getByRole('dialog', { name: /Add item to Living Room/ });

    await user.type(within(drawer).getByLabelText('Name'), 'Side Table');
    await user.type(within(drawer).getByLabelText('Category'), 'Casegoods');
    await user.type(within(drawer).getByLabelText('ID'), 'TB-02');
    await user.type(within(drawer).getByLabelText('Dimensions'), '20 x 20 x 24');
    await user.clear(within(drawer).getByLabelText('Quantity'));
    await user.type(within(drawer).getByLabelText('Quantity'), '3');
    await user.clear(within(drawer).getByLabelText('Unit cost'));
    await user.type(within(drawer).getByLabelText('Unit cost'), '250.50');
    await user.type(within(drawer).getByLabelText('Notes'), 'Match sample finish');
    await user.click(within(drawer).getByRole('button', { name: 'Add item' }));

    expect(mockCreateItemMutateAsync).toHaveBeenCalledWith({
      itemName: 'Side Table',
      description: null,
      category: 'Casegoods',
      itemIdTag: 'TB-02',
      dimensions: '20 x 20 x 24',
      qty: 3,
      unitCostCents: 25050,
      notes: 'Match sample finish',
      sortOrder: 2,
    });
    expect(
      screen.queryByRole('dialog', { name: /Add item to Living Room/ }),
    ).not.toBeInTheDocument();
  });

  it('sets the category from the suggested category bank', async () => {
    const user = userEvent.setup();
    renderTable();

    await openLivingRoomAddItem(user);
    const drawer = screen.getByRole('dialog', { name: /Add item to Living Room/ });

    await user.click(within(drawer).getByRole('button', { name: 'Accessories' }));

    expect(within(drawer).getByLabelText('Category')).toHaveValue('Accessories');
  });

  it('opens the material library and creates a new assigned material', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByRole('button', { name: 'Edit item materials' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Finish Library' });
    await user.type(within(dialog).getByLabelText('Name'), 'Ivory boucle');
    await user.type(within(dialog).getByLabelText('ID'), 'FAB-001');
    await user.click(within(dialog).getByRole('button', { name: 'Add and assign' }));

    expect(mockCreateAndAssignMaterialMutateAsync).toHaveBeenCalledWith({
      itemId: 'item-1',
      input: {
        name: 'Ivory boucle',
        materialId: 'FAB-001',
        description: '',
        swatchHex: '#D9D4C8',
      },
    });
  });

  it('creates and assigns a material from the add item drawer', async () => {
    const user = userEvent.setup();
    renderTable();

    await openLivingRoomAddItem(user);
    const drawer = screen.getByRole('dialog', { name: /Add item to Living Room/ });

    await user.type(within(drawer).getByLabelText('Name'), 'Accent Chair');
    await user.type(within(drawer).getByLabelText('Materials'), 'Ivory boucle');
    await user.click(within(drawer).getByRole('button', { name: 'Select' }));
    await user.click(within(drawer).getByRole('button', { name: 'Add item' }));

    expect(mockCreateItemMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ itemName: 'Accent Chair' }),
    );
    expect(mockCreateAndAssignMaterialMutateAsync).toHaveBeenCalledWith({
      itemId: 'item-created',
      input: {
        name: 'Ivory boucle',
      },
    });
  });

  it('opens the project material form from the add item drawer', async () => {
    const user = userEvent.setup();
    renderTable();

    await openLivingRoomAddItem(user);
    const drawer = screen.getByRole('dialog', { name: /Add item to Living Room/ });

    await user.click(within(drawer).getByRole('button', { name: 'Add material' }));

    expect(screen.getByRole('dialog', { name: 'Finish Library' })).toBeInTheDocument();
  });

  it('keeps the drawer open and validates before adding an item', async () => {
    const user = userEvent.setup();
    renderTable();

    await openLivingRoomAddItem(user);
    const drawer = screen.getByRole('dialog', { name: /Add item to Living Room/ });
    await user.click(within(drawer).getByRole('button', { name: 'Add item' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(mockCreateItemMutateAsync).not.toHaveBeenCalled();
  });

  it('removes a location from FF&E without moving its items', async () => {
    const user = userEvent.setup();
    renderTable();

    await openLivingRoomActions(user);
    await user.click(screen.getByRole('menuitem', { name: 'Remove from FF&E' }));

    expect(screen.getByText(/has 2 items/)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: /Remove Living Room from FF&E/ });
    expect(within(dialog).getByText(/Proposal table/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Remove from FF&E' }));

    expect(mockMoveItemMutateAsync).not.toHaveBeenCalled();
    expect(mockDeleteRoomMutateAsync).toHaveBeenCalledWith('room-1');
  });

  it('duplicates an item with identical editable fields', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: 'Open item actions for Lounge Chair' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    expect(mockCreateItemMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        itemName: 'Lounge Chair',
        category: 'Seating',
        itemIdTag: 'CH-01',
        dimensions: '28 x 30 x 31',
        qty: 2,
        unitCostCents: 123456,
        notes: 'COM approved',
        sortOrder: 2,
      }),
    );
  });

  it('calculates sort_order patches for drag-and-drop reorder', () => {
    const patches = getSortOrderPatches(fixture[0]!.items, 'item-2', 'item-1');

    expect(patches.map(({ item, sortOrder }) => ({ id: item.id, sortOrder }))).toEqual([
      { id: 'item-2', sortOrder: 0 },
      { id: 'item-1', sortOrder: 1 },
    ]);
  });
});
