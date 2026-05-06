import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCreateItem, useUpdateItem } from './useItems';
import type { Item } from '../../types';

// â”€â”€â”€ Hoisted stubs (available inside vi.mock factory closures) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const { MockApiError, mockItemsCreate, mockItemsUpdate, mockToastError } = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body: unknown = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  }
  return {
    MockApiError,
    mockItemsCreate: vi.fn<() => Promise<Item>>(),
    mockItemsUpdate: vi.fn<() => Promise<Item>>(),
    mockToastError: vi.fn<(msg: string) => void>(),
  };
});

vi.mock('../../lib/auth', () => ({
  auth: { currentUser: null },
}));

vi.mock('../../lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../../lib/auth-state', () => ({
  useAuthUser: () => ({ user: null, isLoading: false }),
}));

vi.mock('../../lib/api', () => ({
  ApiError: MockApiError,
  api: {
    items: {
      update: mockItemsUpdate,
      create: mockItemsCreate,
      list: vi.fn(),
      delete: vi.fn(),
    },
    projects: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    rooms: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  roomId: 'room-1',
  itemName: 'Original Name',
  description: null,
  category: null,
  itemIdTag: null,
  dimensions: null,
  seatHeight: null,
  notes: null,
  qty: 1,
  unitCostCents: 10000,
  leadTime: null,
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

const createTestClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const makeWrapper =
  (qc: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

// â”€â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('useUpdateItem', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = createTestClient();
    qc.setQueryData<Item[]>(['items', 'room-1'], [makeItem()]);
  });

  it('applies the optimistic update before the server responds', async () => {
    let settle!: (item: Item) => void;
    mockItemsUpdate.mockReturnValueOnce(
      new Promise<Item>((res) => {
        settle = res;
      }),
    );

    const { result } = renderHook(() => useUpdateItem('room-1'), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        id: 'item-1',
        patch: { itemName: 'Updated Name', version: 1 },
      });
    });

    // Optimistic update is visible immediately (before server responds)
    await waitFor(() => {
      const items = qc.getQueryData<Item[]>(['items', 'room-1']);
      expect(items?.[0]?.itemName).toBe('Updated Name');
    });

    // Settle so the test cleans up properly
    act(() => {
      settle(makeItem({ itemName: 'Updated Name', version: 2 }));
    });
  });

  it('rolls back to the previous state when the server returns an error', async () => {
    mockItemsUpdate.mockRejectedValueOnce(new MockApiError(500, 'Server error'));

    const { result } = renderHook(() => useUpdateItem('room-1'), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        id: 'item-1',
        patch: { itemName: 'Updated Name', version: 1 },
      });
    });

    await waitFor(() => {
      const items = qc.getQueryData<Item[]>(['items', 'room-1']);
      expect(items?.[0]?.itemName).toBe('Original Name');
    });
  });

  it('shows a 409-specific message for version conflicts', async () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    mockItemsUpdate.mockRejectedValueOnce(new MockApiError(409, 'Version conflict'));

    const { result } = renderHook(() => useUpdateItem('room-1'), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        id: 'item-1',
        patch: { itemName: 'X', version: 1 },
      });
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('This item changed in another tab - reloading');
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 'room-1'] });
  });
});

describe('useCreateItem', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = createTestClient();
    qc.setQueryData<Item[]>(['items', 'room-1'], [makeItem()]);
  });

  it('adds an optimistic item before the server responds', async () => {
    let settle!: (item: Item) => void;
    mockItemsCreate.mockReturnValueOnce(
      new Promise<Item>((res) => {
        settle = res;
      }),
    );

    const { result } = renderHook(() => useCreateItem('room-1'), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        itemName: 'New Side Table',
        qty: 2,
        unitCostCents: 12_500,
      });
    });

    await waitFor(() => {
      const items = qc.getQueryData<Item[]>(['items', 'room-1']);
      const optimistic = items?.find((item) => item.id.startsWith('optimistic-'));
      expect(optimistic).toBeDefined();
      expect(optimistic?.itemName).toBe('New Side Table');
      expect(optimistic?.qty).toBe(2);
      expect(optimistic?.unitCostCents).toBe(12_500);
    });

    act(() => {
      settle(makeItem({ id: 'item-created', itemName: 'New Side Table', version: 1 }));
    });

    await waitFor(() => {
      const items = qc.getQueryData<Item[]>(['items', 'room-1']);
      expect(items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'item-created' })]),
      );
    });
  });
});
