import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Finish, Material, Project } from '../../types';
import {
  MATERIALS_ACTIONS_SLOT_ID,
  MATERIALS_FILTER_SLOT_ID,
  MaterialsView,
} from './MaterialsView';

const mockState = vi.hoisted(() => ({
  finishes: [] as Finish[],
  materials: [] as Material[],
  finishesRefetch: vi.fn(() => Promise.resolve()),
  materialsRefetch: vi.fn(() => Promise.resolve()),
  deleteFinishMutateAsync: vi.fn(() => Promise.resolve()),
  deleteMaterialMutateAsync: vi.fn(() => Promise.resolve()),
  createFinishMutateAsync: vi.fn(() => Promise.resolve()),
  updateFinishMutateAsync: vi.fn(() => Promise.resolve()),
  createMaterialMutateAsync: vi.fn(() => Promise.resolve()),
  updateMaterialMutateAsync: vi.fn(() => Promise.resolve()),
  uploadImageMutateAsync: vi.fn(() => Promise.resolve()),
  deleteImageMutateAsync: vi.fn(() => Promise.resolve()),
  exportFinishesExcel: vi.fn(),
  exportFinishesPdf: vi.fn(),
  exportMaterialsExcel: vi.fn(),
  exportMaterialsPdf: vi.fn(),
}));

vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks')>();
  return {
    ...actual,
    useFinishes: () => ({
      data: mockState.finishes,
      isLoading: false,
      refetch: mockState.finishesRefetch,
    }),
    useMaterials: () => ({
      data: mockState.materials,
      isLoading: false,
      refetch: mockState.materialsRefetch,
    }),
    useCreateFinish: () => ({ mutateAsync: mockState.createFinishMutateAsync }),
    useUpdateFinish: () => ({ mutateAsync: mockState.updateFinishMutateAsync }),
    useDeleteFinish: () => ({ mutateAsync: mockState.deleteFinishMutateAsync }),
    useCreateMaterial: () => ({ mutateAsync: mockState.createMaterialMutateAsync }),
    useUpdateMaterial: () => ({ mutateAsync: mockState.updateMaterialMutateAsync }),
    useDeleteMaterial: () => ({ mutateAsync: mockState.deleteMaterialMutateAsync }),
    useUploadImage: () => ({ mutateAsync: mockState.uploadImageMutateAsync }),
    useDeleteImage: () => ({ mutateAsync: mockState.deleteImageMutateAsync }),
    useImages: () => ({ data: [] }),
  };
});

vi.mock('../../lib/export', () => ({
  exportFinishesExcel: mockState.exportFinishesExcel,
  exportFinishesPdf: mockState.exportFinishesPdf,
  exportMaterialsExcel: mockState.exportMaterialsExcel,
  exportMaterialsPdf: mockState.exportMaterialsPdf,
}));

vi.mock('../shared/image/ImageFrame', () => ({
  ImageFrame: () => <div data-testid="image-frame" />,
}));

function makeProject(): Project {
  return {
    id: 'project-1',
    ownerUid: 'u1',
    name: 'Test Project',
    clientName: 'Client Co.',
    budgetCents: 100000,
    proposalStatus: 'in_progress',
    proposalStatusUpdatedAt: '2024-01-01T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function makeFinish(id: string, name: string): Finish {
  return {
    id,
    projectId: 'project-1',
    code: `${id}-code`,
    name,
    category: 'wood',
    subCategory: 'Subtype',
    description: `${name} description`,
    manufacturer: 'Maker',
    sourceUrl: '',
    swatchHex: '#D9D4C8',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function makeMaterial(id: string, name: string): Material {
  return {
    id,
    projectId: 'project-1',
    code: `${id}-code`,
    finishId: null,
    materialType: 'solid',
    name,
    materialId: `${id}-mfr`,
    description: `${name} description`,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function renderView() {
  const filterSlot = document.createElement('div');
  filterSlot.id = MATERIALS_FILTER_SLOT_ID;
  document.body.appendChild(filterSlot);

  const actionsSlot = document.createElement('div');
  actionsSlot.id = MATERIALS_ACTIONS_SLOT_ID;
  document.body.appendChild(actionsSlot);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MaterialsView project={makeProject()} />
    </QueryClientProvider>,
  );
}

describe('MaterialsView options actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mockState.finishes = [makeFinish('finish-1', 'Walnut'), makeFinish('finish-2', 'Oak')];
    mockState.materials = [makeMaterial('material-1', 'Laminate')];
  });

  it('routes options export actions by active tab', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /options/i }));
    expect(screen.queryByRole('menuitem', { name: /export csv/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /^export$/i }));
    expect(await screen.findByRole('menuitem', { name: /export csv/i })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /export csv/i }));

    expect(mockState.exportFinishesExcel).toHaveBeenCalledWith(
      expect.any(Object),
      expect.arrayContaining(mockState.finishes),
      'csv',
    );
    expect(mockState.exportMaterialsExcel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /options/i }));
    await user.click(screen.getByRole('radio', { name: /table/i }));
    await user.click(screen.getByRole('menuitem', { name: /^export$/i }));
    await user.click(screen.getByRole('menuitem', { name: /export excel/i }));
    expect(mockState.exportFinishesExcel).toHaveBeenCalledWith(
      expect.any(Object),
      expect.arrayContaining(mockState.finishes),
    );

    await user.click(screen.getByRole('radio', { name: /project materials/i }));
    await user.click(screen.getByRole('button', { name: /options/i }));
    await user.click(screen.getByRole('menuitem', { name: /^export$/i }));
    await user.click(screen.getByRole('menuitem', { name: /export pdf/i }));

    expect(mockState.exportMaterialsPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      mockState.materials,
    );
  });

  it('disables export when the active filtered list is empty', async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(screen.getByRole('textbox', { name: /search finishes/i }), 'no-match-term');
    await user.click(screen.getByRole('button', { name: /options/i }));
    expect(screen.getByRole('menuitem', { name: /^export$/i })).toBeDisabled();
    expect(screen.queryByRole('menuitem', { name: /export csv/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /project materials/i }));
    await user.click(screen.getByRole('button', { name: /options/i }));
    expect(screen.getByRole('menuitem', { name: /^export$/i })).toBeDisabled();
  });

  it('runs delete-all through per-item delete hooks for each tab', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /options/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete all/i }));

    expect(await screen.findByText('This will permanently delete 2 finishes.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Deleting finishes will not delete project materials, and finish relationships may need relinking.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete 2 finishes' }));

    await waitFor(() => {
      expect(mockState.deleteFinishMutateAsync).toHaveBeenCalledTimes(2);
      expect(mockState.deleteFinishMutateAsync).toHaveBeenCalledWith('finish-1');
      expect(mockState.deleteFinishMutateAsync).toHaveBeenCalledWith('finish-2');
      expect(mockState.finishesRefetch).toHaveBeenCalledTimes(1);
    });
    expect(mockState.deleteMaterialMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: /project materials/i }));
    await user.click(screen.getByRole('button', { name: /options/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete all/i }));

    expect(
      await screen.findByText('This will permanently delete 1 project materials.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete 1 project materials' }));

    await waitFor(() => {
      expect(mockState.deleteMaterialMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockState.deleteMaterialMutateAsync).toHaveBeenCalledWith('material-1');
      expect(mockState.materialsRefetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('finish name collision prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mockState.finishes = [makeFinish('finish-1', 'Walnut'), makeFinish('finish-2', 'Oak')];
    mockState.materials = [];
  });

  async function openFinishForm() {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: /new finish/i }));
    const formDialog = await screen.findByRole('dialog', { name: /add finish/i });
    return { user, formDialog };
  }

  it('shows collision prompt when creating a finish with a duplicate name', async () => {
    const { user, formDialog } = await openFinishForm();

    await user.type(within(formDialog).getByRole('textbox', { name: /name/i }), 'Walnut');
    await user.click(within(formDialog).getByRole('button', { name: /add to library/i }));

    expect(
      await screen.findByRole('dialog', { name: /finish name conflict/i }),
    ).toBeInTheDocument();
    expect(mockState.createFinishMutateAsync).not.toHaveBeenCalled();
  });

  it('detects collision case-insensitively', async () => {
    const { user, formDialog } = await openFinishForm();

    await user.type(within(formDialog).getByRole('textbox', { name: /name/i }), 'walnut');
    await user.click(within(formDialog).getByRole('button', { name: /add to library/i }));

    expect(
      await screen.findByRole('dialog', { name: /finish name conflict/i }),
    ).toBeInTheDocument();
    expect(mockState.createFinishMutateAsync).not.toHaveBeenCalled();
  });

  it('closes form without creating finish when Use existing is clicked', async () => {
    const { user, formDialog } = await openFinishForm();

    await user.type(within(formDialog).getByRole('textbox', { name: /name/i }), 'Walnut');
    await user.click(within(formDialog).getByRole('button', { name: /add to library/i }));

    const collisionDialog = await screen.findByRole('dialog', { name: /finish name conflict/i });
    await user.click(within(collisionDialog).getByRole('button', { name: /use existing/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /finish name conflict/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /add finish/i })).not.toBeInTheDocument();
    });
    expect(mockState.createFinishMutateAsync).not.toHaveBeenCalled();
    expect(mockState.uploadImageMutateAsync).not.toHaveBeenCalled();
  });

  it('closes form without creating or uploading when Overwrite swatch is clicked with no staged image', async () => {
    const { user, formDialog } = await openFinishForm();

    await user.type(within(formDialog).getByRole('textbox', { name: /name/i }), 'Walnut');
    await user.click(within(formDialog).getByRole('button', { name: /add to library/i }));

    const collisionDialog = await screen.findByRole('dialog', { name: /finish name conflict/i });
    await user.click(within(collisionDialog).getByRole('button', { name: /overwrite swatch/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /finish name conflict/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /add finish/i })).not.toBeInTheDocument();
    });
    expect(mockState.createFinishMutateAsync).not.toHaveBeenCalled();
    expect(mockState.uploadImageMutateAsync).not.toHaveBeenCalled();
  });

  it('dismisses collision prompt and keeps form open on Cancel', async () => {
    const { user, formDialog } = await openFinishForm();

    await user.type(within(formDialog).getByRole('textbox', { name: /name/i }), 'Walnut');
    await user.click(within(formDialog).getByRole('button', { name: /add to library/i }));

    const collisionDialog = await screen.findByRole('dialog', { name: /finish name conflict/i });
    await user.click(within(collisionDialog).getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /finish name conflict/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: /add finish/i })).toBeInTheDocument();
    expect(mockState.createFinishMutateAsync).not.toHaveBeenCalled();
  });

  it('creates finish normally when name has no collision', async () => {
    const { user, formDialog } = await openFinishForm();

    await user.type(within(formDialog).getByRole('textbox', { name: /name/i }), 'Cherry');
    await user.click(within(formDialog).getByRole('button', { name: /add to library/i }));

    await waitFor(() => {
      expect(mockState.createFinishMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Cherry' }),
      );
    });
    expect(screen.queryByRole('dialog', { name: /finish name conflict/i })).not.toBeInTheDocument();
  });
});
