import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { catalogProjectFixture, catalogRoomsFixture } from '../../../data/catalogFixture';
import { CatalogEditorPanel, type CatalogEditorState } from './CatalogEditorPanel';
import type { CatalogEntry } from './CatalogPage';

const mutateUpdateItem = vi.fn();

vi.mock('../../../hooks', () => ({
  useUpdateItem: () => ({
    mutate: mutateUpdateItem,
    isPending: false,
  }),
  useDeleteImage: () => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  }),
  useImages: () => ({
    data: [],
    isLoading: false,
  }),
  useUploadImage: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useMaterialCellPaste: () => ({
    isPasting: false,
    pasteIntoCell: vi.fn(),
  }),
}));

function makeEditorState(): CatalogEditorState {
  return {
    editorOpen: true,
    layoutConfig: {
      mainImageAlignment: 'center',
      planImageSize: 'thumbnail',
      showCostInfo: false,
      showSwatchLabels: true,
      showApproval: true,
      showVerticalDivider: false,
      showHorizontalDivider: false,
      showVendor: false,
    },
    media: {
      optionSlots: [
        { slot: 1, status: 'empty' },
        { slot: 2, status: 'empty' },
      ],
    },
    typography: {
      fontFamily: 'source-sans-3',
      titleColorToken: 'ink-950',
      bodyColorToken: 'ink-800',
      metaColorToken: 'slate-700',
    },
    watermark: {
      enabled: false,
      placementH: 'left',
      placementV: 'footer',
      opacity: 30,
      includeName: false,
    },
  };
}

function makeEntry(): CatalogEntry {
  const room = catalogRoomsFixture[0]!;
  const item = room.items[0]!;
  return { room, item };
}

describe('CatalogEditorPanel', () => {
  beforeEach(() => {
    mutateUpdateItem.mockReset();
  });

  it('renders item status control in the Text tab and persists through useUpdateItem', async () => {
    const user = userEvent.setup();
    const entry = makeEntry();
    const targetStatus = entry.item.status === 'ordered' ? 'approved' : 'ordered';

    render(
      <CatalogEditorPanel
        project={catalogProjectFixture}
        currentEntry={entry}
        editorState={makeEditorState()}
        onTypographyChange={vi.fn()}
        onLayoutChange={vi.fn()}
        watermarkConfig={makeEditorState().watermark}
        onWatermarkChange={vi.fn()}
        logoDataUrl={null}
        onClose={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /item status/i }), targetStatus);

    expect(mutateUpdateItem).toHaveBeenCalledWith({
      id: entry.item.id,
      patch: {
        status: targetStatus,
        version: entry.item.version,
      },
    });
  });

  it('switches editor sections from the category dropdown', async () => {
    const user = userEvent.setup();

    render(
      <CatalogEditorPanel
        project={catalogProjectFixture}
        currentEntry={makeEntry()}
        editorState={makeEditorState()}
        onTypographyChange={vi.fn()}
        onLayoutChange={vi.fn()}
        watermarkConfig={makeEditorState().watermark}
        onWatermarkChange={vi.fn()}
        logoDataUrl={null}
        onClose={vi.fn()}
      />,
    );

    const categorySelect = screen.getByRole('combobox', { name: /catalog editor category/i });
    await user.selectOptions(categorySelect, 'media');

    expect(categorySelect).toHaveValue('media');
    expect(
      screen.getByText('Option image and swatch controls are being consolidated here.'),
    ).toBeInTheDocument();
  });

  it('renders document mark placement as a dropdown and emits placement updates', async () => {
    const user = userEvent.setup();
    const onWatermarkChange = vi.fn();
    const enabledWatermark = { ...makeEditorState().watermark, enabled: true };

    render(
      <CatalogEditorPanel
        project={catalogProjectFixture}
        currentEntry={makeEntry()}
        editorState={makeEditorState()}
        onTypographyChange={vi.fn()}
        onLayoutChange={vi.fn()}
        watermarkConfig={enabledWatermark}
        onWatermarkChange={onWatermarkChange}
        logoDataUrl="data:image/png;base64,abc"
        onClose={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /catalog editor category/i }), [
      'document-mark',
    ]);
    await user.selectOptions(screen.getByRole('combobox', { name: /document mark placement/i }), [
      'footer-right',
    ]);

    expect(onWatermarkChange).toHaveBeenCalledWith({
      placementV: 'footer',
      placementH: 'right',
      enabled: true,
    });
  });
});
