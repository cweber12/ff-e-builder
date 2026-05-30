import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Finish, Material } from '../../types';
import { MaterialBadges, MaterialLibraryPanel } from './MaterialLibraryModal';

const mockState = vi.hoisted(() => ({
  finishes: [] as Finish[],
  materials: [] as Material[],
  updateMutateAsync: vi.fn(),
  assignMutateAsync: vi.fn(),
  removeMutateAsync: vi.fn(),
  updateItemMaterialMutateAsync: vi.fn(),
  createAndAssignMutateAsync: vi.fn(),
}));

vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks')>();
  return {
    ...actual,
    useFinishes: () => ({ data: mockState.finishes, isLoading: false }),
    useMaterials: () => ({ data: mockState.materials, isLoading: false }),
    useCreateMaterial: () => ({ mutateAsync: vi.fn() }),
    useUpdateMaterial: () => ({ mutateAsync: mockState.updateMutateAsync }),
    useItemMaterialActions: () => ({
      assign: { mutateAsync: mockState.assignMutateAsync },
      remove: { mutateAsync: mockState.removeMutateAsync },
      update: { mutateAsync: mockState.updateItemMaterialMutateAsync },
      createAndAssign: { mutateAsync: mockState.createAndAssignMutateAsync },
    }),
  };
});

vi.mock('../shared/image/ImageFrame', () => ({
  ImageFrame: () => <div data-testid="image-frame" />,
}));

function makeFinish(id: string, name: string, code = ''): Finish {
  return {
    id,
    projectId: 'project-1',
    code,
    name,
    category: 'wood',
    subCategory: '',
    description: '',
    manufacturer: '',
    sourceUrl: '',
    swatchHex: '#D9D4C8',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function makeMaterial(id: string, name: string, finishId: string | null = null): Material {
  return {
    id,
    projectId: 'project-1',
    code: `${id}-code`,
    finishId,
    materialType: 'solid',
    name,
    materialId: `${id}-mfr`,
    description: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function renderPanel() {
  return render(<MaterialLibraryPanel context="ffe" projectId="project-1" roomId="room-1" />);
}

function makeClipboardData(file: File) {
  return {
    items: [
      {
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      },
    ],
  };
}

describe('MaterialLibraryModal edit layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.finishes = [
      makeFinish('finish-1', 'Walnut', 'WAL-1'),
      makeFinish('finish-2', 'Oak', 'OAK-2'),
    ];
    mockState.materials = [
      makeMaterial('mat-1', 'Door Pull', 'finish-1'),
      makeMaterial('mat-2', 'Shelf', null),
    ];
  });

  it('shows the finish picker grid alongside the edit form when editing a material', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));

    expect(screen.getByRole('region', { name: 'Finish library' })).toBeInTheDocument();
    expect(screen.getByLabelText('Apply finish Walnut')).toBeInTheDocument();
    expect(screen.getByLabelText('Apply finish Oak')).toBeInTheDocument();
  });

  it('does not show the finish picker grid when creating a new material', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: '+ New material' }));

    expect(screen.queryByRole('region', { name: 'Finish library' })).not.toBeInTheDocument();
  });

  it('hides the finish picker grid after cancelling edit', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));
    expect(screen.getByRole('region', { name: 'Finish library' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Finish library' })).not.toBeInTheDocument();
  });

  it('marks the currently-assigned finish as selected', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));

    expect(screen.getByLabelText('Apply finish Walnut')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Apply finish Oak')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('MaterialLibraryModal finish picker search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.finishes = [
      makeFinish('finish-1', 'Walnut', 'WAL-1'),
      makeFinish('finish-2', 'Oak', 'OAK-2'),
    ];
    mockState.materials = [makeMaterial('mat-1', 'Door Pull')];
  });

  it('filters finishes by name in the picker grid', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));
    await user.type(screen.getByLabelText('Search finishes'), 'wal');

    expect(screen.getByLabelText('Apply finish Walnut')).toBeInTheDocument();
    expect(screen.queryByLabelText('Apply finish Oak')).not.toBeInTheDocument();
  });
});

describe('MaterialLibraryModal finish selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.finishes = [
      makeFinish('finish-1', 'Walnut', 'WAL-1'),
      makeFinish('finish-2', 'Oak', 'OAK-2'),
    ];
    mockState.materials = [makeMaterial('mat-1', 'Door Pull', 'finish-1')];
    mockState.updateMutateAsync.mockResolvedValue(makeMaterial('mat-1', 'Door Pull', 'finish-2'));
  });

  it('selects a finish on click without persisting until save', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));
    await user.click(screen.getByLabelText('Apply finish Oak'));

    expect(screen.getByLabelText('Apply finish Oak')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Apply finish Walnut')).toHaveAttribute('aria-pressed', 'false');
    expect(mockState.updateMutateAsync).not.toHaveBeenCalled();
  });

  it('cancelling after selecting a finish does not persist', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));
    await user.click(screen.getByLabelText('Apply finish Oak'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockState.updateMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Finish library' })).not.toBeInTheDocument();
  });

  it('persists the selected finish when Save is clicked', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));
    await user.click(screen.getByLabelText('Apply finish Oak'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockState.updateMutateAsync).toHaveBeenCalledWith({
      id: 'mat-1',
      patch: {
        name: 'Door Pull',
        code: 'mat-1-code',
        finishId: 'finish-2',
        materialType: 'solid',
        materialId: 'mat-1-mfr',
        description: '',
      },
    });
  });
});

describe('MaterialBadges paste routing', () => {
  it('routes inline paste to onPasteImage for empty material slots', () => {
    const onPasteImage = vi.fn();
    const swatch = new File(['png'], 'swatch.png', { type: 'image/png' });

    render(
      <MaterialBadges
        materials={[]}
        onOpen={vi.fn()}
        onPasteImage={onPasteImage}
        getFinishName={vi.fn()}
      />,
    );

    fireEvent.paste(screen.getByRole('button', { name: 'Edit item materials' }), {
      clipboardData: makeClipboardData(swatch),
    });

    expect(onPasteImage).toHaveBeenCalledTimes(1);
    expect(onPasteImage).toHaveBeenCalledWith(swatch);
  });

  it('routes document paste while focused and stops after blur', () => {
    const onPasteImage = vi.fn();
    const swatch = new File(['png'], 'swatch.png', { type: 'image/png' });

    render(
      <MaterialBadges
        materials={[makeMaterial('mat-1', 'Door Pull', 'finish-1')]}
        onOpen={vi.fn()}
        onPasteImage={onPasteImage}
        getFinishName={vi.fn()}
      />,
    );

    const pasteTarget = screen.getByTitle('Paste swatch image (Ctrl+V)');
    fireEvent.focus(pasteTarget);
    fireEvent.paste(document, { clipboardData: makeClipboardData(swatch) });

    expect(onPasteImage).toHaveBeenCalledTimes(1);

    fireEvent.blur(pasteTarget);
    fireEvent.paste(document, { clipboardData: makeClipboardData(swatch) });

    expect(onPasteImage).toHaveBeenCalledTimes(1);
  });
});
