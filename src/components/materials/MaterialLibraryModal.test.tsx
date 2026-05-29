import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Finish, Material } from '../../types';
import { MaterialLibraryPanel } from './MaterialLibraryModal';

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

function makeDt(returnId: string) {
  return {
    setData: vi.fn(),
    getData: vi.fn().mockReturnValue(returnId),
    effectAllowed: '',
  };
}

describe('MaterialLibraryModal dual-pane layout', () => {
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

  it('shows finish library panel alongside edit form when editing a material', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));

    expect(screen.getByRole('region', { name: 'Finish library' })).toBeInTheDocument();
    expect(screen.getByLabelText('Assign Walnut')).toBeInTheDocument();
    expect(screen.getByLabelText('Assign Oak')).toBeInTheDocument();
  });

  it('does not show finish library panel when creating a new material', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: '+ New material' }));

    expect(screen.queryByRole('region', { name: 'Finish library' })).not.toBeInTheDocument();
  });

  it('hides finish library panel after cancelling edit', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));
    expect(screen.getByRole('region', { name: 'Finish library' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Finish library' })).not.toBeInTheDocument();
  });
});

describe('MaterialLibraryModal finish library search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.finishes = [
      makeFinish('finish-1', 'Walnut', 'WAL-1'),
      makeFinish('finish-2', 'Oak', 'OAK-2'),
    ];
    mockState.materials = [makeMaterial('mat-1', 'Door Pull')];
  });

  it('filters finishes by name in the library panel', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));
    await user.type(screen.getByLabelText('Search finish library'), 'wal');

    expect(screen.getByLabelText('Assign Walnut')).toBeInTheDocument();
    expect(screen.queryByLabelText('Assign Oak')).not.toBeInTheDocument();
  });
});

describe('MaterialLibraryModal drag-to-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.finishes = [
      makeFinish('finish-1', 'Walnut', 'WAL-1'),
      makeFinish('finish-2', 'Oak', 'OAK-2'),
    ];
    mockState.materials = [makeMaterial('mat-1', 'Door Pull', 'finish-1')];
    mockState.updateMutateAsync.mockResolvedValue(makeMaterial('mat-1', 'Door Pull', 'finish-2'));
  });

  it('updates finish preview on drop without persisting', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));

    const dropZone = screen.getByLabelText('Finish drop zone');
    const dt = makeDt('finish-2');
    fireEvent.dragOver(dropZone, { dataTransfer: dt });
    fireEvent.drop(dropZone, { dataTransfer: dt });

    // Form now previews Oak without persisting
    expect(screen.getByText('Oak')).toBeInTheDocument();
    expect(mockState.updateMutateAsync).not.toHaveBeenCalled();
  });

  it('same-finish drop is a no-op', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));

    // Door Pull already has finish-1 (Walnut)
    expect(screen.getByText('Walnut')).toBeInTheDocument();

    const dropZone = screen.getByLabelText('Finish drop zone');
    const dt = makeDt('finish-1');
    fireEvent.dragOver(dropZone, { dataTransfer: dt });
    fireEvent.drop(dropZone, { dataTransfer: dt });

    // Still shows Walnut; state unchanged
    expect(screen.getByText('Walnut')).toBeInTheDocument();
    expect(mockState.updateMutateAsync).not.toHaveBeenCalled();
  });

  it('cancel after drag restores draft without persisting', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));

    const dropZone = screen.getByLabelText('Finish drop zone');
    fireEvent.drop(dropZone, { dataTransfer: makeDt('finish-2') });

    // Preview changed to Oak
    expect(screen.getByText('Oak')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockState.updateMutateAsync).not.toHaveBeenCalled();
    // Form is closed; no persistence occurred
    expect(screen.queryByLabelText('Finish drop zone')).not.toBeInTheDocument();
  });

  it('persists dragged finish when Save is clicked', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));

    fireEvent.drop(screen.getByLabelText('Finish drop zone'), { dataTransfer: makeDt('finish-2') });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockState.updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mat-1' }),
    );
  });

  it('click on finish in library updates preview without drag', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Door Pull' }));
    await user.click(screen.getByLabelText('Assign Oak'));

    expect(screen.getByText('Oak')).toBeInTheDocument();
    expect(mockState.updateMutateAsync).not.toHaveBeenCalled();
  });
});
