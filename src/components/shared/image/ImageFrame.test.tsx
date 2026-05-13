import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageFrame } from './ImageFrame';

const { mockUploadMutate, mockDeleteMutate } = vi.hoisted(() => ({
  mockUploadMutate: vi.fn(),
  mockDeleteMutate: vi.fn(),
}));

vi.mock('../../../hooks', () => ({
  useImages: vi.fn(() => ({ data: [], isLoading: false })),
  useUploadImage: vi.fn(() => ({ mutate: mockUploadMutate, isPending: false })),
  useDeleteImage: vi.fn(() => ({ mutate: mockDeleteMutate, isPending: false })),
  useUpdateImageCrop: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  isPersistedImageEntityId: vi.fn(() => true),
}));

vi.mock('../../../lib/api', () => ({
  api: { images: { getContentBlob: vi.fn() } },
}));

describe('ImageFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadMutate.mockImplementation(
      (_variables: unknown, options?: { onError?: (err: Error) => void }) => {
        options?.onError?.(new Error('This row already has a rendering'));
      },
    );
  });

  it('shows an inline upload error for a rendering upload failure', () => {
    const { container } = render(
      <ImageFrame
        entityType="proposal_item"
        entityId="00000000-0000-0000-0000-000000000002"
        alt="MI-1 rendering"
      />,
    );

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: { files: [new File(['image-bytes'], 'rendering.png', { type: 'image/png' })] },
    });

    expect(screen.getByText('This row already has a rendering')).toBeInTheDocument();
  });
});
