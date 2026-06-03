import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Finish, Material, Project } from '../../types';
import {
  MATERIALS_ACTIONS_SLOT_ID,
  MATERIALS_FILTER_SLOT_ID,
  MATERIALS_FINISHES_PANEL_SLOT_ID,
  MATERIALS_HEADER_VIEW_SLOT_ID,
  MATERIALS_OPTIONS_SLOT_ID,
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
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
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

vi.mock('../primitives/toastApi', () => ({
  toast: {
    success: mockState.toastSuccess,
    error: mockState.toastError,
  },
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

function makeMaterial(id: string, name: string, finishId: string | null = null): Material {
  return {
    id,
    projectId: 'project-1',
    code: `${id}-code`,
    finishId,
    materialType: 'solid',
    name,
    materialId: `${id}-mfr`,
    description: `${name} description`,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function installDesktopMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderView() {
  const filterSlot = document.createElement('div');
  filterSlot.id = MATERIALS_FILTER_SLOT_ID;
  document.body.appendChild(filterSlot);

  const actionsSlot = document.createElement('div');
  actionsSlot.id = MATERIALS_ACTIONS_SLOT_ID;
  document.body.appendChild(actionsSlot);

  const optionsSlot = document.createElement('div');
  optionsSlot.id = MATERIALS_OPTIONS_SLOT_ID;
  document.body.appendChild(optionsSlot);

  const headerViewSlot = document.createElement('div');
  headerViewSlot.id = MATERIALS_HEADER_VIEW_SLOT_ID;
  document.body.appendChild(headerViewSlot);

  const finishesPanelSlot = document.createElement('div');
  finishesPanelSlot.id = MATERIALS_FINISHES_PANEL_SLOT_ID;
  document.body.appendChild(finishesPanelSlot);

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

describe('MaterialsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    installDesktopMatchMedia();
    mockState.finishes = [makeFinish('finish-1', 'Walnut'), makeFinish('finish-2', 'Oak')];
    mockState.materials = [makeMaterial('material-1', 'Laminate')];
  });

  it('routes materials and finishes export actions through their own menus', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /materials options/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download' }));
    await user.click(screen.getByRole('menuitem', { name: /download csv/i }));

    expect(mockState.exportMaterialsExcel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      mockState.materials,
      'csv',
    );
    expect(mockState.exportFinishesExcel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /open finishes/i }));
    await user.click(screen.getByRole('button', { name: /finishes options/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download' }));
    await user.click(screen.getByRole('menuitem', { name: /download pdf/i }));

    expect(mockState.exportFinishesPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      expect.arrayContaining(mockState.finishes),
    );
  });

  it('runs delete-all from the materials controls and finishes panel separately', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /materials options/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete all/i }));

    expect(
      await screen.findByText('This will permanently delete 1 project materials.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete 1 project materials' }));

    await waitFor(() => {
      expect(mockState.deleteMaterialMutateAsync).toHaveBeenCalledWith('material-1');
      expect(mockState.materialsRefetch).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: /open finishes/i }));
    await user.click(screen.getByRole('button', { name: /finishes options/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete all/i }));

    expect(await screen.findByText('This will permanently delete 2 finishes.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete 2 finishes' }));

    await waitFor(() => {
      expect(mockState.deleteFinishMutateAsync).toHaveBeenCalledTimes(2);
      expect(mockState.deleteFinishMutateAsync).toHaveBeenCalledWith('finish-1');
      expect(mockState.deleteFinishMutateAsync).toHaveBeenCalledWith('finish-2');
      expect(mockState.finishesRefetch).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the finish collision prompt from the finishes panel create action', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /open finishes/i }));
    await user.click(screen.getByRole('button', { name: /new finish/i }));

    const formDialog = await screen.findByRole('dialog', { name: /add finish/i });
    await user.type(within(formDialog).getByRole('textbox', { name: /name/i }), 'Walnut');
    await user.click(within(formDialog).getByRole('button', { name: /add to library/i }));

    expect(
      await screen.findByRole('dialog', { name: /finish name conflict/i }),
    ).toBeInTheDocument();
    expect(mockState.createFinishMutateAsync).not.toHaveBeenCalled();
  });

  it('drops a finish onto a material and persists the finish assignment', async () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: /open finishes/i }));

    const finishRow = await screen.findByLabelText('Drag finish Oak');
    const materialCard = screen.getByText('Laminate').closest('article');

    expect(materialCard).not.toBeNull();

    const dataTransfer = {
      effectAllowed: 'move',
      setData: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent.dragStart(finishRow, { dataTransfer });
    fireEvent.dragOver(materialCard!, { dataTransfer });
    fireEvent.drop(materialCard!, { dataTransfer });

    await waitFor(() => {
      expect(mockState.updateMaterialMutateAsync).toHaveBeenCalledWith({
        id: 'material-1',
        patch: { finishId: 'finish-2' },
      });
      expect(mockState.toastSuccess).toHaveBeenCalledWith('Applied Oak to Laminate.');
    });
  });

  it('moves delete into the finish editor footer', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /open finishes/i }));
    const walnutRow = screen.getByLabelText('Drag finish Walnut');
    await user.click(within(walnutRow).getByRole('button', { name: 'Edit' }));

    const dialog = await screen.findByRole('dialog', { name: /edit finish/i });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockState.deleteFinishMutateAsync).toHaveBeenCalledWith('finish-1');
    });
  });
});
