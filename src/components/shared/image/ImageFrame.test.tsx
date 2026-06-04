import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { ImageFrame } from './ImageFrame';

const { mockUploadMutate, mockDeleteMutate, mockUseImages, mockGetContentBlob } = vi.hoisted(
  () => ({
    mockUploadMutate: vi.fn(),
    mockDeleteMutate: vi.fn(),
    mockUseImages: vi.fn(() => ({
      data: [] as Array<{ id: string; isPrimary?: boolean }>,
      isLoading: false,
    })),
    mockGetContentBlob: vi.fn(),
  }),
);

vi.mock('../../../hooks', () => ({
  useImages: mockUseImages,
  useUploadImage: vi.fn(() => ({ mutate: mockUploadMutate, isPending: false })),
  useDeleteImage: vi.fn(() => ({ mutate: mockDeleteMutate, isPending: false })),
  useUpdateImageCrop: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  isPersistedImageEntityId: vi.fn(() => true),
}));

vi.mock('../../../lib/api', () => ({
  api: { images: { getContentBlob: mockGetContentBlob } },
}));

describe('ImageFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseImages.mockReturnValue({ data: [], isLoading: false });
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

  it('routes pasted images through the upload mutate path', () => {
    render(
      <ImageFrame
        entityType="proposal_item"
        entityId="00000000-0000-0000-0000-000000000002"
        alt="MI-1 rendering"
      />,
    );

    const frame = screen.getByTitle('Upload, paste, or update image');
    const file = new File(['image-bytes'], 'rendering.png', { type: 'image/png' });

    fireEvent.paste(frame, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
      preventDefault: vi.fn(),
    });

    expect(mockUploadMutate).toHaveBeenCalledTimes(1);
    expect(mockUploadMutate).toHaveBeenCalledWith(
      { file, altText: 'MI-1 rendering' },
      expect.any(Object),
    );
  });

  it('shows the simplified hover affordances for editable images', () => {
    render(
      <ImageFrame
        entityType="proposal_item"
        entityId="00000000-0000-0000-0000-000000000002"
        alt="MI-1 rendering"
      />,
    );

    expect(screen.getByText('Paste image')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add image for MI-1 rendering' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Ctrl+V paste')).not.toBeInTheDocument();
  });

  it('fetches image content immediately when eager loading is enabled', async () => {
    mockUseImages.mockReturnValue({
      data: [{ id: 'image-1', isPrimary: true }],
      isLoading: false,
    });
    mockGetContentBlob.mockResolvedValue(new Blob(['image-bytes'], { type: 'image/png' }));

    render(
      <ImageFrame
        entityType="proposal_item"
        entityId="00000000-0000-0000-0000-000000000002"
        alt="MI-1 rendering"
        eager
      />,
    );

    await waitFor(() => expect(mockGetContentBlob).toHaveBeenCalledWith('image-1'));
  });
});
