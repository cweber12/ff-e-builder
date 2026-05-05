import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectImagesModal } from './ProjectImagesModal';
import type { ImageAsset } from '../../types';

const { mockUploadMutate, mockDeleteMutate, mockPrimaryMutate, mockUseImages } = vi.hoisted(() => ({
  mockUploadMutate: vi.fn(),
  mockDeleteMutate: vi.fn(),
  mockPrimaryMutate: vi.fn(),
  mockUseImages: vi.fn(() => ({ data: [] as ImageAsset[], isLoading: false })),
}));

vi.mock('../../hooks', () => ({
  useImages: mockUseImages,
  useUploadImage: vi.fn(() => ({ mutate: mockUploadMutate, isPending: false })),
  useDeleteImage: vi.fn(() => ({ mutate: mockDeleteMutate, isPending: false })),
  useSetPrimaryImage: vi.fn(() => ({ mutate: mockPrimaryMutate, isPending: false })),
  useUpdateImageCrop: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('../../lib/api', () => ({
  api: { images: { getContentBlob: vi.fn().mockResolvedValue(new Blob()) } },
}));

const makeImage = (overrides: Partial<ImageAsset> = {}): ImageAsset => ({
  id: '00000000-0000-0000-0000-000000000010',
  entityType: 'project',
  ownerUid: 'uid-1',
  projectId: '00000000-0000-0000-0000-000000000001',
  roomId: null,
  itemId: null,
  materialId: null,
  proposalItemId: null,
  filename: 'image.png',
  contentType: 'image/png',
  byteSize: 1024,
  altText: 'Sample Project image',
  isPrimary: false,
  cropX: null,
  cropY: null,
  cropWidth: null,
  cropHeight: null,
  createdAt: '2026-05-03T00:00:00Z',
  updatedAt: '2026-05-03T00:00:00Z',
  ...overrides,
});

const PROJECT = {
  id: '00000000-0000-0000-0000-000000000001',
  ownerUid: 'uid-1',
  name: 'Sample Project',
  clientName: '',
  companyName: '',
  projectLocation: '',
  budgetMode: 'shared' as const,
  budgetCents: 0,
  ffeBudgetCents: 0,
  proposalBudgetCents: 0,
  createdAt: '2026-05-03T00:00:00Z',
  updatedAt: '2026-05-03T00:00:00Z',
};

describe('ProjectImagesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseImages.mockReturnValue({ data: [], isLoading: false });
    mockUploadMutate.mockImplementation(
      (_variables: unknown, options?: { onError?: (err: Error) => void }) => {
        options?.onError?.(new Error('Projects can have up to 3 images'));
      },
    );
  });

  it('shows an inline upload error for the failing project image slot', () => {
    const { container } = render(<ProjectImagesModal open onClose={() => {}} project={PROJECT} />);

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: { files: [new File(['image-bytes'], 'project.png', { type: 'image/png' })] },
    });

    expect(screen.getByText('Projects can have up to 3 images')).toBeInTheDocument();
  });
});

describe('ProjectImagesModal – full slot flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseImages.mockReturnValue({ data: [], isLoading: false });
    mockUploadMutate.mockImplementation(
      (_variables: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );
  });

  it('renders Remove buttons and Preview radio for each loaded image', async () => {
    const img1 = makeImage({ id: 'img-1', isPrimary: true, altText: 'Sample Project image' });
    const img2 = makeImage({ id: 'img-2', isPrimary: false, altText: 'Sample Project image 2' });
    mockUseImages.mockReturnValue({ data: [img1, img2], isLoading: false });

    render(<ProjectImagesModal open onClose={() => {}} project={PROJECT} />);

    await waitForLoadedProjectImages(2);

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons).toHaveLength(2);

    const previewRadios = screen.getAllByRole('radio', { name: /preview/i });
    expect(previewRadios).toHaveLength(2);
    expect(previewRadios[0]).toBeChecked();
    expect(previewRadios[1]).not.toBeChecked();
  });

  it('uploads pasted image from project image slot', async () => {
    render(<ProjectImagesModal open onClose={() => {}} project={PROJECT} />);

    const slot = screen.getAllByRole('button', { name: /upload image for sample project/i })[0]!;
    const file = new File(['paste'], 'paste.png', { type: 'image/png' });
    const clipboardData = {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        },
      ],
    };

    fireEvent.paste(slot, { clipboardData });

    await waitFor(() => {
      expect(mockUploadMutate).toHaveBeenCalled();
    });
  });

  it('shows error only on the slot that failed, not on other slots', async () => {
    const user = userEvent.setup();
    // Slot 0 has an image; slot 1 is empty and will fail on upload
    const img1 = makeImage({ id: 'img-1', isPrimary: true });
    mockUseImages.mockReturnValue({ data: [img1], isLoading: false });
    mockUploadMutate.mockImplementation(
      (_variables: unknown, options?: { onError?: (err: Error) => void }) => {
        options?.onError?.(new Error('Projects can have up to 3 images'));
      },
    );

    const { container } = render(<ProjectImagesModal open onClose={() => {}} project={PROJECT} />);

    await waitForLoadedProjectImages(1);

    // All three file inputs are rendered (one per slot)
    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(fileInputs).toHaveLength(3);

    // Upload into the second slot (index 1)
    await user.upload(fileInputs[1]!, new File(['bytes'], 'new.png', { type: 'image/png' }));

    const errors = screen.getAllByText('Projects can have up to 3 images');
    expect(errors).toHaveLength(1);

    // The error is inside the second slot, not the first
    const slots = container.querySelectorAll<HTMLElement>('div.grid.gap-2');
    expect(within(slots[1]!).getByText('Projects can have up to 3 images')).toBeInTheDocument();
    expect(within(slots[0]!).queryByText('Projects can have up to 3 images')).toBeNull();
  });

  it('calls deleteImage.mutate with the correct image id when Remove is clicked', async () => {
    const user = userEvent.setup();
    const img = makeImage({ id: 'img-to-delete', isPrimary: true });
    mockUseImages.mockReturnValue({ data: [img], isLoading: false });

    render(<ProjectImagesModal open onClose={() => {}} project={PROJECT} />);

    await waitForLoadedProjectImages(1);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(mockDeleteMutate).toHaveBeenCalledWith('img-to-delete');
  });

  it('calls setPrimary.mutate when a non-preview radio is selected', async () => {
    const user = userEvent.setup();
    const img1 = makeImage({ id: 'img-primary', isPrimary: true });
    const img2 = makeImage({ id: 'img-secondary', isPrimary: false });
    mockUseImages.mockReturnValue({ data: [img1, img2], isLoading: false });

    render(<ProjectImagesModal open onClose={() => {}} project={PROJECT} />);

    await waitForLoadedProjectImages(2);

    const radios = screen.getAllByRole('radio', { name: /preview/i });
    await user.click(radios[1]!);

    expect(mockPrimaryMutate).toHaveBeenCalledWith('img-secondary');
  });
});

async function waitForLoadedProjectImages(count: number) {
  await waitFor(() => {
    expect(screen.getAllByRole('button', { name: 'Sample Project image' })).toHaveLength(count);
  });
}
