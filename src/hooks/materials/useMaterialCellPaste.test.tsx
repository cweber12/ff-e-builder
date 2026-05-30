import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageAsset, Material } from '../../types';
import { useMaterialCellPaste } from './useMaterialCellPaste';

const {
  mockCreateFinishMutateAsync,
  mockCreateAndAssignMutateAsync,
  mockUpdateMutateAsync,
  mockUploadMutateAsync,
  mockInvalidateQueries,
  mockGetQueryData,
  mockFetchQuery,
  mockSetPrimaryImage,
  mockDeleteImage,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockCreateFinishMutateAsync: vi.fn(),
  mockCreateAndAssignMutateAsync: vi.fn(),
  mockUpdateMutateAsync: vi.fn(),
  mockUploadMutateAsync: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockGetQueryData: vi.fn(),
  mockFetchQuery: vi.fn(),
  mockSetPrimaryImage: vi.fn(),
  mockDeleteImage: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      getQueryData: mockGetQueryData,
      fetchQuery: mockFetchQuery,
    }),
  };
});

vi.mock('../../lib/api', () => ({
  api: {
    images: {
      list: vi.fn(),
      setPrimary: mockSetPrimaryImage,
      delete: mockDeleteImage,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

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

function makeImage(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id: 'image-1',
    entityType: 'finish',
    ownerUid: 'u1',
    projectId: 'project-1',
    companyId: null,
    roomId: null,
    itemId: null,
    materialId: null,
    finishId: 'finish-existing',
    proposalItemId: null,
    filename: 'swatch.png',
    contentType: 'image/png',
    byteSize: 1024,
    altText: 'Swatch',
    isPrimary: true,
    cropX: null,
    cropY: null,
    cropWidth: null,
    cropHeight: null,
    thumbnailR2Key: null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('useMaterialCellPaste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvalidateQueries.mockResolvedValue(undefined);
    mockCreateFinishMutateAsync.mockResolvedValue({ id: 'finish-1' });
    mockCreateAndAssignMutateAsync.mockResolvedValue(
      makeMaterial({ id: 'material-created', finishId: 'finish-1' }),
    );
    mockUpdateMutateAsync.mockResolvedValue(makeMaterial({ finishId: 'finish-1' }));
    mockUploadMutateAsync.mockResolvedValue(makeImage());
    mockGetQueryData.mockReturnValue(undefined);
    mockFetchQuery.mockResolvedValue([]);
    mockSetPrimaryImage.mockResolvedValue(makeImage({ id: 'image-prev' }));
    mockDeleteImage.mockResolvedValue(undefined);
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

    expect(mockCreateFinishMutateAsync).toHaveBeenCalledWith({ name: '' });
    expect(mockCreateAndAssignMutateAsync).toHaveBeenCalledWith({
      itemId: 'item-1',
      input: { name: '', materialId: '', finishId: 'finish-1' },
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
    expect(mockCreateFinishMutateAsync).toHaveBeenCalledWith({ name: '' });
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

  it('sends empty names so server assigns default names', async () => {
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

    expect(mockCreateFinishMutateAsync).toHaveBeenCalledWith({ name: '' });
    expect(mockCreateAndAssignMutateAsync).toHaveBeenCalledWith({
      itemId: 'item-1',
      input: { name: '', materialId: '', finishId: 'finish-1' },
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
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Swatch updated.',
      expect.objectContaining({ duration: 10000 }),
    );
  });

  it('restores the previous primary swatch when Undo is clicked', async () => {
    mockGetQueryData.mockReturnValueOnce([makeImage({ id: 'image-prev', isPrimary: true })]);
    mockUploadMutateAsync.mockResolvedValueOnce(makeImage({ id: 'image-new', isPrimary: true }));

    const { result } = renderHook(() =>
      useMaterialCellPaste('project-1', {
        kind: 'ffe',
        itemGroupId: 'room-1',
        projectId: 'project-1',
      }),
    );

    await act(async () => {
      await result.current.pasteIntoCell({
        itemId: 'item-1',
        materials: [makeMaterial({ finishId: 'finish-existing', name: 'Walnut' })],
        file: new File(['img'], 'swatch.png', { type: 'image/png' }),
        confirmOverwrite: () => true,
      });
    });

    const toastOptions = mockToastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined;
    expect(toastOptions?.action?.onClick).toBeTypeOf('function');

    await act(async () => {
      toastOptions?.action?.onClick?.();
      await Promise.resolve();
    });

    expect(mockSetPrimaryImage).toHaveBeenCalledWith('image-prev');
    expect(mockDeleteImage).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith('Previous swatch restored.');
  });

  it('shows non-blocking error when Undo cannot restore previous swatch', async () => {
    mockGetQueryData.mockReturnValueOnce([makeImage({ id: 'image-prev', isPrimary: true })]);
    mockUploadMutateAsync.mockResolvedValueOnce(makeImage({ id: 'image-new', isPrimary: true }));
    mockSetPrimaryImage.mockRejectedValueOnce(new Error('restore failed'));

    const { result } = renderHook(() =>
      useMaterialCellPaste('project-1', {
        kind: 'ffe',
        itemGroupId: 'room-1',
        projectId: 'project-1',
      }),
    );

    await act(async () => {
      await result.current.pasteIntoCell({
        itemId: 'item-1',
        materials: [makeMaterial({ finishId: 'finish-existing', name: 'Walnut' })],
        file: new File(['img'], 'swatch.png', { type: 'image/png' }),
        confirmOverwrite: () => true,
      });
    });

    const toastOptions = mockToastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined;

    await act(async () => {
      toastOptions?.action?.onClick?.();
      await Promise.resolve();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'Undo could not restore the previous swatch image.',
    );
  });
});
