import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../types';

const hookMocks = vi.hoisted(() => ({
  createPlanMeasurementMutateAsync: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  proposalUpdateItem: vi.fn(),
}));

vi.mock('../components/plans/canvas/PlanViewport', () => ({
  PlanViewport: vi.fn(
    ({
      onMeasurementDraftChange,
      onNaturalSizeChange,
    }: {
      onMeasurementDraftChange: (draft: {
        startX: number;
        startY: number;
        endX: number;
        endY: number;
      }) => void;
      onNaturalSizeChange: (size: { width: number; height: number }) => void;
    }) => (
      <div data-testid="plan-viewport">
        <button
          type="button"
          onClick={() => {
            onNaturalSizeChange({ width: 1000, height: 1000 });
            onMeasurementDraftChange({ startX: 0, startY: 0, endX: 100, endY: 200 });
          }}
        >
          Draw measurement draft
        </button>
      </div>
    ),
  ),
}));

import { PlanCanvasPage } from './PlanCanvasPage';

const project: Project = {
  id: 'project-1',
  ownerUid: 'user-1',
  name: 'Hotel Renovation',
  clientName: 'Client',
  companyName: 'Studio',
  projectLocation: 'Seattle',
  budgetMode: 'shared' as const,
  budgetCents: 0,
  ffeBudgetCents: 0,
  proposalBudgetCents: 0,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2026-05-01T00:00:00Z',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-06T00:00:00Z',
};

const roomsWithItems = [
  {
    id: 'room-1',
    projectId: 'project-1',
    name: 'Lobby',
    sortOrder: 0,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    items: [
      {
        id: 'item-1',
        roomId: 'room-1',
        itemName: 'Banquette',
        description: null,
        category: null,
        itemIdTag: 'A-101',
        dimensions: null,
        notes: null,
        qty: 1,
        unitCostCents: 0,
        leadTime: null,
        status: 'pending' as const,
        customData: {},
        sortOrder: 0,
        version: 1,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
        materials: [],
      },
    ],
  },
];

const proposalCategoriesWithItems = [
  {
    id: 'proposal-category-1',
    projectId: 'project-1',
    name: 'Millwork',
    sortOrder: 0,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    items: [
      {
        id: 'proposal-item-1',
        categoryId: 'proposal-category-1',
        productTag: 'P-42',
        itemName: 'Reception millwork',
        plan: '',
        drawings: '',
        location: '',
        description: 'Reception millwork',
        notes: '',
        sizeLabel: '',
        sizeMode: 'imperial' as const,
        sizeW: '',
        sizeD: '',
        sizeH: '',
        sizeUnit: 'ft/in' as const,
        footprintLabel: '',
        footprintW: '',
        footprintD: '',
        footprintUnit: '',
        footprintArea: null,
        materials: [],
        cbm: 0,
        quantity: 1,
        quantityUnit: 'unit',
        unitCostCents: 0,
        sortOrder: 0,
        version: 1,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
        customData: {},
      },
      {
        id: 'proposal-item-2',
        categoryId: 'proposal-category-1',
        productTag: 'P-43',
        itemName: 'Display millwork',
        plan: '',
        drawings: 'A0-1',
        location: '',
        description: 'Display millwork',
        notes: '',
        sizeLabel: '',
        sizeMode: 'imperial' as const,
        sizeW: '',
        sizeD: '',
        sizeH: '',
        sizeUnit: 'ft/in' as const,
        footprintLabel: '',
        footprintW: '',
        footprintD: '',
        footprintUnit: '',
        footprintArea: null,
        materials: [],
        cbm: 0,
        quantity: 1,
        quantityUnit: 'unit',
        unitCostCents: 0,
        sortOrder: 1,
        version: 4,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
        customData: {},
      },
    ],
  },
];

vi.mock('../hooks', () => ({
  useMeasuredPlans: vi.fn(() => ({
    data: [
      {
        id: 'plan-1',
        projectId: 'project-1',
        ownerUid: 'user-1',
        name: 'Level 1 Furniture Plan',
        sheetReference: 'A1.1',
        sourceType: 'image' as const,
        imageFilename: 'plan.png',
        imageContentType: 'image/png',
        imageByteSize: 1024,
        pdfFilename: null,
        pdfContentType: null,
        pdfByteSize: null,
        pdfPageNumber: null,
        pdfPageWidthPt: null,
        pdfPageHeightPt: null,
        pdfRenderScale: null,
        pdfRenderedWidthPx: null,
        pdfRenderedHeightPx: null,
        pdfRotation: null,
        calibrationStatus: 'uncalibrated',
        measurementCount: 0,
        createdAt: '2026-05-06T00:00:00Z',
        updatedAt: '2026-05-06T00:00:00Z',
      },
      {
        id: 'plan-2',
        projectId: 'project-1',
        ownerUid: 'user-1',
        name: 'Level 2 Furniture Plan',
        sheetReference: 'A1.2',
        sourceType: 'image' as const,
        imageFilename: 'plan-2.png',
        imageContentType: 'image/png',
        imageByteSize: 2048,
        pdfFilename: null,
        pdfContentType: null,
        pdfByteSize: null,
        pdfPageNumber: null,
        pdfPageWidthPt: null,
        pdfPageHeightPt: null,
        pdfRenderScale: null,
        pdfRenderedWidthPx: null,
        pdfRenderedHeightPx: null,
        pdfRotation: null,
        calibrationStatus: 'calibrated',
        measurementCount: 3,
        createdAt: '2026-05-06T00:00:00Z',
        updatedAt: '2026-05-06T00:00:00Z',
      },
    ],
    isLoading: false,
  })),
  usePlanCalibration: vi.fn((_projectId: string, planId: string) => ({
    data:
      planId === 'plan-2'
        ? {
            id: 'cal-1',
            measuredPlanId: 'plan-2',
            startX: 120,
            startY: 80,
            endX: 420,
            endY: 80,
            realWorldLength: 12,
            unit: 'ft',
            pixelsPerUnit: 25,
            createdAt: '2026-05-06T00:00:00Z',
            updatedAt: '2026-05-06T00:00:00Z',
          }
        : null,
    isLoading: false,
  })),
  usePlanLengthLines: vi.fn((_projectId: string, planId: string) => ({
    data:
      planId === 'plan-2'
        ? [
            {
              id: 'line-1',
              measuredPlanId: 'plan-2',
              startX: 120,
              startY: 120,
              endX: 420,
              endY: 120,
              measuredLengthBase: 3657.6,
              label: 'Banquette wall',
              createdAt: '2026-05-06T00:00:00Z',
              updatedAt: '2026-05-06T00:00:00Z',
            },
          ]
        : [],
    isLoading: false,
  })),
  usePlanMeasurements: vi.fn((_projectId: string, planId: string) => ({
    data:
      planId === 'plan-2'
        ? [
            {
              id: 'measurement-1',
              measuredPlanId: 'plan-2',
              targetKind: 'ffe',
              targetItemId: 'item-1',
              targetTagSnapshot: 'A-101',
              rectX: 100,
              rectY: 120,
              rectWidth: 240,
              rectHeight: 180,
              horizontalSpanBase: 3657.6,
              verticalSpanBase: 2743.2,
              cropX: 120,
              cropY: 140,
              cropWidth: 160,
              cropHeight: 100,
              createdAt: '2026-05-06T00:00:00Z',
              updatedAt: '2026-05-06T00:00:00Z',
            },
            {
              id: 'measurement-2',
              measuredPlanId: 'plan-2',
              targetKind: 'proposal',
              targetItemId: 'proposal-item-1',
              targetTagSnapshot: 'P-42',
              rectX: 360,
              rectY: 180,
              rectWidth: 220,
              rectHeight: 160,
              horizontalSpanBase: 3352.8,
              verticalSpanBase: 2438.4,
              cropX: 390,
              cropY: 210,
              cropWidth: 140,
              cropHeight: 90,
              createdAt: '2026-05-06T00:00:00Z',
              updatedAt: '2026-05-06T00:00:00Z',
            },
          ]
        : [],
    isLoading: false,
  })),
  useSetPlanCalibration: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useCreatePlanLengthLine: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdatePlanLengthLine: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeletePlanLengthLine: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useCreatePlanMeasurement: vi.fn(() => ({
    mutateAsync: hookMocks.createPlanMeasurementMutateAsync,
    isPending: false,
  })),
  useUpdatePlanMeasurement: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeletePlanMeasurement: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('../lib/api', () => ({
  api: {
    plans: {
      downloadContent: vi.fn(() => Promise.resolve(new Blob(['preview']))),
    },
    images: {
      list: vi.fn(() => Promise.resolve([])),
      delete: vi.fn(() => Promise.resolve()),
      upload: vi.fn(() =>
        Promise.resolve({
          id: 'image-1',
          entityType: 'proposal_plan',
          ownerUid: 'user-1',
          projectId: 'project-1',
          roomId: null,
          itemId: null,
          materialId: null,
          proposalItemId: 'proposal-item-1',
          filename: 'plan.png',
          contentType: 'image/png',
          byteSize: 1024,
          altText: 'P-42 plan image',
          isPrimary: true,
          cropX: null,
          cropY: null,
          cropWidth: null,
          cropHeight: null,
          createdAt: '2026-05-06T00:00:00Z',
          updatedAt: '2026-05-06T00:00:00Z',
        }),
      ),
      setCrop: vi.fn((imageId: string, params: unknown) =>
        Promise.resolve({
          id: imageId,
          entityType: 'proposal_plan',
          ownerUid: 'user-1',
          projectId: 'project-1',
          roomId: null,
          itemId: null,
          materialId: null,
          proposalItemId: 'proposal-item-1',
          filename: 'plan.png',
          contentType: 'image/png',
          byteSize: 1024,
          altText: 'P-42 plan image',
          isPrimary: true,
          ...(params as object),
          createdAt: '2026-05-06T00:00:00Z',
          updatedAt: '2026-05-06T00:00:00Z',
        }),
      ),
    },
    proposal: {
      updateItem: apiMocks.proposalUpdateItem,
    },
  },
}));

function renderPlanCanvasPage(planId: 'plan-1' | 'plan-2') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlanCanvasPage
          project={project}
          planId={planId}
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlanCanvasPage', () => {
  beforeEach(() => {
    hookMocks.createPlanMeasurementMutateAsync.mockReset();
    apiMocks.proposalUpdateItem.mockReset();
  });

  it('renders the workspace shell for uncalibrated plans', () => {
    renderPlanCanvasPage('plan-1');

    expect(screen.getByRole('heading', { name: 'Level 1 Furniture Plan' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sheet/i })).toHaveValue('plan-1');
    expect(screen.getByRole('option', { name: /A1.2 - Level 2 Furniture Plan/i })).toHaveValue(
      'plan-2',
    );
    expect(screen.getByRole('button', { name: 'Open previous sheet' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open next sheet' })).not.toBeDisabled();
    expect(screen.getByTestId('plan-viewport')).toBeInTheDocument();
  });

  it('enables previous sheet navigation on later sheets', () => {
    renderPlanCanvasPage('plan-2');

    expect(screen.getByRole('combobox', { name: /sheet/i })).toHaveValue('plan-2');
    expect(screen.getByRole('button', { name: 'Open previous sheet' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open next sheet' })).toBeDisabled();
  });

  it('appends the active sheet reference when applying a measurement to a proposal item', async () => {
    const displayMillwork = proposalCategoriesWithItems[0]?.items[1];
    if (!displayMillwork) throw new Error('Expected display millwork test fixture.');

    hookMocks.createPlanMeasurementMutateAsync.mockResolvedValue({
      id: 'measurement-3',
      measuredPlanId: 'plan-2',
      targetKind: 'proposal',
      targetItemId: 'proposal-item-2',
      targetTagSnapshot: 'P-43',
      rectX: 0,
      rectY: 0,
      rectWidth: 100,
      rectHeight: 200,
      horizontalSpanBase: 1219.2,
      verticalSpanBase: 2438.4,
      cropX: null,
      cropY: null,
      cropWidth: null,
      cropHeight: null,
      createdAt: '2026-05-06T00:00:00Z',
      updatedAt: '2026-05-06T00:00:00Z',
    });
    apiMocks.proposalUpdateItem.mockResolvedValue({
      ...displayMillwork,
      drawings: 'A0-1, A1.2',
      quantity: 32,
      quantityUnit: 'sq ft',
      version: 5,
    });

    renderPlanCanvasPage('plan-2');

    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draw measurement draft' }));
    fireEvent.click(screen.getByRole('button', { name: /P-43 Display millwork/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & apply to item' }));

    await waitFor(() => {
      expect(apiMocks.proposalUpdateItem).toHaveBeenCalledWith(
        'proposal-item-2',
        expect.objectContaining({
          drawings: 'A0-1, A1.2',
          quantity: 32,
          quantityUnit: 'sq ft',
          version: 4,
        }),
      );
    });
  });
});
