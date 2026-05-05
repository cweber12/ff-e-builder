import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useDeleteImage,
  useSetPrimaryImage,
  useUpdateImageCrop,
  useUploadImage,
} from './useImages';
import type { ImageAsset } from '../../types';

const {
  mockImagesUpload,
  mockImagesDelete,
  mockImagesSetPrimary,
  mockImagesSetCrop,
  mockToastError,
} = vi.hoisted(() => ({
  mockImagesUpload: vi.fn<() => Promise<ImageAsset>>(),
  mockImagesDelete: vi.fn<() => Promise<void>>(),
  mockImagesSetPrimary: vi.fn<() => Promise<ImageAsset>>(),
  mockImagesSetCrop: vi.fn<() => Promise<ImageAsset>>(),
  mockToastError: vi.fn<(msg: string) => void>(),
}));

vi.mock('../../lib/auth', () => ({
  auth: { currentUser: null },
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuthUser: () => ({ user: null, isLoading: false }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    images: {
      list: vi.fn(),
      upload: mockImagesUpload,
      delete: mockImagesDelete,
      setPrimary: mockImagesSetPrimary,
      setCrop: mockImagesSetCrop,
      getContentBlob: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));

const makeImage = (overrides: Partial<ImageAsset> = {}): ImageAsset => ({
  id: '00000000-0000-0000-0000-000000000011',
  entityType: 'project',
  ownerUid: 'user-123',
  projectId: '00000000-0000-0000-0000-000000000001',
  roomId: null,
  itemId: null,
  materialId: null,
  proposalItemId: null,
  filename: 'image-1.png',
  contentType: 'image/png',
  byteSize: 123,
  altText: 'Project image',
  isPrimary: true,
  cropX: null,
  cropY: null,
  cropWidth: null,
  cropHeight: null,
  createdAt: '2026-05-03T00:00:00Z',
  updatedAt: '2026-05-03T00:00:00Z',
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

describe('useUploadImage', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = createTestClient();
    qc.setQueryData<ImageAsset[]>(
      ['images', 'project', '00000000-0000-0000-0000-000000000001'],
      [makeImage()],
    );
  });

  it('demotes the previous primary image in cache when a new image uploads', async () => {
    mockImagesUpload.mockResolvedValueOnce(
      makeImage({
        id: '00000000-0000-0000-0000-000000000012',
        filename: 'image-2.png',
        altText: 'Project image 2',
        isPrimary: true,
      }),
    );

    const { result } = renderHook(
      () => useUploadImage('project', '00000000-0000-0000-0000-000000000001'),
      {
        wrapper: makeWrapper(qc),
      },
    );

    act(() => {
      result.current.mutate({
        file: new File(['image-bytes'], 'image-2.png', { type: 'image/png' }),
        altText: 'Project image 2',
      });
    });

    await waitFor(() => {
      const images = qc.getQueryData<ImageAsset[]>([
        'images',
        'project',
        '00000000-0000-0000-0000-000000000001',
      ]);
      expect(images?.[0]?.id).toBe('00000000-0000-0000-0000-000000000012');
      expect(images?.[0]?.isPrimary).toBe(true);
      expect(images?.[1]?.isPrimary).toBe(false);
    });
  });
});

describe('useDeleteImage', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = createTestClient();
  });

  it('invalidates the image query after delete so preview state is reloaded', async () => {
    mockImagesDelete.mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(
      () => useDeleteImage('project', '00000000-0000-0000-0000-000000000001'),
      {
        wrapper: makeWrapper(qc),
      },
    );

    act(() => {
      result.current.mutate('00000000-0000-0000-0000-000000000011');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['images', 'project', '00000000-0000-0000-0000-000000000001'],
      });
    });
  });
});

describe('useSetPrimaryImage', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = createTestClient();
    qc.setQueryData<ImageAsset[]>(
      ['images', 'project', '00000000-0000-0000-0000-000000000001'],
      [
        makeImage({ id: '00000000-0000-0000-0000-000000000011', isPrimary: true }),
        makeImage({ id: '00000000-0000-0000-0000-000000000012', isPrimary: false }),
      ],
    );
  });

  it('marks only the selected image as primary in cache', async () => {
    mockImagesSetPrimary.mockResolvedValueOnce(
      makeImage({ id: '00000000-0000-0000-0000-000000000012', isPrimary: true }),
    );

    const { result } = renderHook(
      () => useSetPrimaryImage('project', '00000000-0000-0000-0000-000000000001'),
      {
        wrapper: makeWrapper(qc),
      },
    );

    act(() => {
      result.current.mutate('00000000-0000-0000-0000-000000000012');
    });

    await waitFor(() => {
      const images = qc.getQueryData<ImageAsset[]>([
        'images',
        'project',
        '00000000-0000-0000-0000-000000000001',
      ]);
      expect(images?.find((image) => image.id.endsWith('0011'))?.isPrimary).toBe(false);
      expect(images?.find((image) => image.id.endsWith('0012'))?.isPrimary).toBe(true);
    });
  });
});

describe('useUpdateImageCrop', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = createTestClient();
    qc.setQueryData<ImageAsset[]>(
      ['images', 'project', '00000000-0000-0000-0000-000000000001'],
      [makeImage()],
    );
  });

  it('replaces the updated image in cache', async () => {
    mockImagesSetCrop.mockResolvedValueOnce(
      makeImage({
        cropX: 1,
        cropY: 2,
        cropWidth: 300,
        cropHeight: 200,
      }),
    );

    const { result } = renderHook(
      () => useUpdateImageCrop('project', '00000000-0000-0000-0000-000000000001'),
      {
        wrapper: makeWrapper(qc),
      },
    );

    act(() => {
      result.current.mutate({
        imageId: '00000000-0000-0000-0000-000000000011',
        params: { cropX: 1, cropY: 2, cropWidth: 300, cropHeight: 200 },
      });
    });

    await waitFor(() => {
      const images = qc.getQueryData<ImageAsset[]>([
        'images',
        'project',
        '00000000-0000-0000-0000-000000000001',
      ]);
      expect(images?.[0]).toMatchObject({
        cropX: 1,
        cropY: 2,
        cropWidth: 300,
        cropHeight: 200,
      });
    });
  });
});
