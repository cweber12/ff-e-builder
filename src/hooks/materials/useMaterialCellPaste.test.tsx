import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Material } from '../../types';
import { useMaterialCellPaste } from './useMaterialCellPaste';

const {
  mockCreateFinishMutateAsync,
  mockCreateAndAssignMutateAsync,
  mockUpdateMutateAsync,
  mockUploadMutateAsync,
  mockGetQueryData,
} = vi.hoisted(() => ({
  mockCreateFinishMutateAsync: vi.fn(),
  mockCreateAndAssignMutateAsync: vi.fn(),
  mockUpdateMutateAsync: vi.fn(),
  mockUploadMutateAsync: vi.fn(),
  mockGetQueryData: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      getQueryData: mockGetQueryData,
    }),
  };
});

vi.mock('../finishes/useFinishes', () => ({
  useCreateFinish: () => ({
    mutateAsync: mockCreateFinishMutateAsync,
    isPending: false,
  }),
}));

vi.mock('./useMaterials', () => ({
  useItemMaterialActions: () => ({
    assign: { mutateAsync: vi.fn(), isPending: false },
    createAndAssign: { mutateAsync: mockCreateAndAssignMutateAsync, isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
    update: { mutateAsync: mockUpdateMutateAsync, isPending: false },
  }),
}));

vi.mock('../shared/useImages', () => ({
  useUploadImage: () => ({
    mutateAsync: mockUploadMutateAsync,
    isPending: false,
  }),
}));

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'material-1',
    projectId: 'project-1',
    code: 'M-001',
    finishId: null,
    materialType: null,
    name: 'Material 1',
    materialId: 'MAT-001',
    description: '',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('useMaterialCellPaste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueryData.mockImplementation((queryKey: readonly unknown[]) => {
      if (queryKey[0] === 'materials') return [];
      if (queryKey[0] === 'finishes') return [];
      return undefined;
    });
    mockCreateFinishMutateAsync.mockResolvedValue({ id: 'finish-1' });
    mockCreateAndAssignMutateAsync.mockResolvedValue(
      makeMaterial({ id: 'material-created', finishId: 'finish-1' }),
    );
    mockUpdateMutateAsync.mockResolvedValue(makeMaterial({ finishId: 'finish-1' }));
    mockUploadMutateAsync.mockResolvedValue({ id: 'image-1' });
  });

  it('creates finish and material when cell has no materials', async () => {
    const { result } = renderHook(() =>
      useMaterialCellPaste('project-1', {
        kind: 'ffe',
        itemGroupId: 'room-1',
        projectId: 'project-1',
      }),
    );

    await act(async () => {
      const status = await result.current.pasteIntoCell({
        itemId: 'item-1',
        materials: [],
        file: new File(['img'], 'swatch.png', { type: 'image/png' }),
      });
      expect(status).toBe('created_material');
    });

    expect(mockCreateFinishMutateAsync).toHaveBeenCalledWith({ name: 'FIN 001' });
    expect(mockCreateAndAssignMutateAsync).toHaveBeenCalledWith({
      itemId: 'item-1',
      input: { name: 'MAT 001', materialId: '', finishId: 'finish-1' },
    });
    expect(mockUploadMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'finish',
        entityId: 'finish-1',
      }),
    );
  });

  it('creates and attaches finish to an existing material without finish', async () => {
    const { result } = renderHook(() =>
      useMaterialCellPaste('project-1', {
        kind: 'proposal',
        itemGroupId: 'category-1',
        projectId: 'project-1',
      }),
    );

    await act(async () => {
      const status = await result.current.pasteIntoCell({
        itemId: 'proposal-item-1',
        materials: [makeMaterial({ id: 'material-existing', finishId: null })],
        file: new File(['img'], 'swatch.png', { type: 'image/png' }),
      });
      expect(status).toBe('attached_finish');
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      itemId: 'proposal-item-1',
      materialId: 'material-existing',
      patch: { finishId: 'finish-1' },
    });
    expect(mockCreateFinishMutateAsync).toHaveBeenCalledWith({ name: 'FIN 001' });
    expect(mockUploadMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'finish',
        entityId: 'finish-1',
      }),
    );
  });

  it('patches finish link after create+assign when backend does not attach finish_id', async () => {
    mockCreateAndAssignMutateAsync.mockResolvedValueOnce(
      makeMaterial({ id: 'material-created', finishId: null }),
    );

    const { result } = renderHook(() =>
      useMaterialCellPaste('project-1', {
        kind: 'proposal',
        itemGroupId: 'category-1',
        projectId: 'project-1',
      }),
    );

    await act(async () => {
      await result.current.pasteIntoCell({
        itemId: 'proposal-item-1',
        materials: [],
        file: new File(['img'], 'swatch.png', { type: 'image/png' }),
      });
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      itemId: 'proposal-item-1',
      materialId: 'material-created',
      patch: { finishId: 'finish-1' },
    });
  });

  it('increments generated names from existing project material and finish names', async () => {
    mockGetQueryData.mockImplementation((queryKey: readonly unknown[]) => {
      if (queryKey[0] === 'materials') {
        return [makeMaterial({ name: 'Material 002' }), makeMaterial({ name: 'Not Default' })];
      }
      if (queryKey[0] === 'finishes') {
        return [{ id: 'finish-existing', name: 'Finish 007' }];
      }
      return undefined;
    });

    const { result } = renderHook(() =>
      useMaterialCellPaste('project-1', {
        kind: 'ffe',
        itemGroupId: 'room-1',
        projectId: 'project-1',
      }),
    );

    await act(async () => {
      const status = await result.current.pasteIntoCell({
        itemId: 'item-1',
        materials: [],
        file: new File(['img'], 'swatch.png', { type: 'image/png' }),
      });
      expect(status).toBe('created_material');
    });

    expect(mockCreateFinishMutateAsync).toHaveBeenCalledWith({ name: 'FIN 008' });
    expect(mockCreateAndAssignMutateAsync).toHaveBeenCalledWith({
      itemId: 'item-1',
      input: { name: 'MAT 003', materialId: '', finishId: 'finish-1' },
    });
  });

  it('discards paste when overwrite is declined for existing finish', async () => {
    const { result } = renderHook(() =>
      useMaterialCellPaste('project-1', {
        kind: 'ffe',
        itemGroupId: 'room-1',
        projectId: 'project-1',
      }),
    );

    await act(async () => {
      const status = await result.current.pasteIntoCell({
        itemId: 'item-1',
        materials: [makeMaterial({ finishId: 'finish-existing' })],
        file: new File(['img'], 'swatch.png', { type: 'image/png' }),
        confirmOverwrite: () => false,
      });
      expect(status).toBe('discarded');
    });

    expect(mockUploadMutateAsync).not.toHaveBeenCalled();
    expect(mockCreateFinishMutateAsync).not.toHaveBeenCalled();
    expect(mockCreateAndAssignMutateAsync).not.toHaveBeenCalled();
  });

  it('uploads to the existing finish when overwrite is confirmed', async () => {
    const { result } = renderHook(() =>
      useMaterialCellPaste('project-1', {
        kind: 'proposal',
        itemGroupId: 'category-1',
        projectId: 'project-1',
      }),
    );

    await act(async () => {
      const status = await result.current.pasteIntoCell({
        itemId: 'proposal-item-1',
        materials: [makeMaterial({ finishId: 'finish-existing', name: 'Walnut' })],
        file: new File(['img'], 'swatch.png', { type: 'image/png' }),
        confirmOverwrite: () => true,
      });
      expect(status).toBe('overwritten');
    });

    expect(mockUploadMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'finish',
        entityId: 'finish-existing',
        altText: 'Walnut swatch',
      }),
    );
  });
});
