import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PanZoomFrame } from './PanZoomFrame';

const { mockUploadMutate } = vi.hoisted(() => ({
  mockUploadMutate: vi.fn(),
}));

vi.mock('../../../hooks', () => ({
  useImages: vi.fn(() => ({ data: [], isLoading: false })),
  useUploadImage: vi.fn(() => ({ mutate: mockUploadMutate, isPending: false })),
  isPersistedImageEntityId: vi.fn(() => true),
}));

vi.mock('../../../lib/api', () => ({
  api: { images: { getContentBlob: vi.fn() } },
}));

describe('PanZoomFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes pasted plan images through the upload mutate path when editable', () => {
    render(
      <PanZoomFrame
        entityType="proposal_plan"
        entityId="00000000-0000-0000-0000-000000000002"
        alt="MI-1 plan"
        editable
      />,
    );

    const frame = screen.getByTitle('Replace, paste, or update plan image');
    const file = new File(['image-bytes'], 'plan.png', { type: 'image/png' });

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
      { file, altText: 'MI-1 plan' },
      expect.any(Object),
    );
  });
});
