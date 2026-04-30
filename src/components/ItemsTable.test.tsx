import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { ItemsTable } from './ItemsTable';
import { roomSubtotalCents, projectTotalCents } from '../lib/calc';
import { cents, formatMoney, type Item, type Room } from '../types';
import type { RoomWithItems } from './ItemsTable';

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
  category: 'Seating',
  vendor: 'Muuto',
  model: 'Fiber',
  itemIdTag: 'CH-01',
  dimensions: '28 x 30 x 31',
  seatHeight: '18',
  finishes: 'Oak, ivory textile',
  notes: 'COM approved',
  qty: 2,
  unitCostCents: 123_456,
  markupPct: 20,
  leadTime: '8 weeks',
  status: 'approved',
  imageUrl: null,
  linkUrl: null,
  sortOrder: 0,
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
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
        markupPct: 20,
        qty: 2,
      }),
      makeItem({
        id: 'item-2',
        roomId: 'room-1',
        itemName: 'Floor Lamp',
        category: 'Lighting',
        itemIdTag: 'LT-01',
        unitCostCents: 45_000,
        markupPct: 10,
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
        markupPct: 30,
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
      <ItemsTable roomsWithItems={roomsWithItems} />
    </QueryClientProvider>,
  );
}

describe('ItemsTable', () => {
  beforeEach(() => {
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
    expect(screen.getByText('No items yet')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /Living Room/ }));

    expect(screen.queryByText('Lounge Chair')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('room:room-1:collapsed')).toBe('true');

    unmount();
    renderTable();

    expect(screen.queryByText('Lounge Chair')).not.toBeInTheDocument();
  });

  it('renders five shimmer rows while loading', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ItemsTable roomsWithItems={[]} isLoading />
      </QueryClientProvider>,
    );

    expect(screen.getAllByTestId('items-table-shimmer-row')).toHaveLength(5);
  });
});
