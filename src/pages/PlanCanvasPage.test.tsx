import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlanCanvasPage } from './PlanCanvasPage';

const project = {
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
        seatHeight: null,
        notes: null,
        qty: 1,
        unitCostCents: 0,
        leadTime: null,
        status: 'pending' as const,
        imageUrl: null,
        linkUrl: null,
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
        plan: '',
        drawings: '',
        location: '',
        description: 'Reception millwork',
        sizeLabel: '',
        sizeMode: 'imperial' as const,
        sizeW: '',
        sizeD: '',
        sizeH: '',
        sizeUnit: 'ft/in' as const,
        materials: [],
        cbm: 0,
        quantity: 1,
        quantityUnit: 'unit',
        unitCostCents: 0,
        sortOrder: 0,
        version: 1,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
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
        imageFilename: 'plan.png',
        imageContentType: 'image/png',
        imageByteSize: 1024,
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
        imageFilename: 'plan-2.png',
        imageContentType: 'image/png',
        imageByteSize: 2048,
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
              cropX: null,
              cropY: null,
              cropWidth: null,
              cropHeight: null,
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
    mutateAsync: vi.fn(),
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
  },
}));

describe('PlanCanvasPage', () => {
  it('renders the workspace shell and disables downstream tools when uncalibrated', () => {
    render(
      <MemoryRouter>
        <PlanCanvasPage
          project={project}
          planId="plan-1"
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Level 1 Furniture Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calibrate' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Length Line' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Crop' })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Level 2 Furniture Plan/i })).toHaveAttribute(
      'href',
      '/projects/project-1/plans/plan-2',
    );
    expect(screen.getByText(/No reference line yet/i)).toBeInTheDocument();
  });

  it('shows saved calibration details for calibrated plans', () => {
    render(
      <MemoryRouter>
        <PlanCanvasPage
          project={project}
          planId="plan-2"
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Saved scale')).toBeInTheDocument();
    expect(screen.getAllByText(/12 ft/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Length Line' })).toBeEnabled();
    expect(screen.getByText('Banquette wall')).toBeInTheDocument();
    expect(screen.getByText('Measured Items')).toBeInTheDocument();
    expect(screen.getByText('A-101')).toBeInTheDocument();
  });

  it('shows crop guidance for a selected measured item on calibrated plans', () => {
    render(
      <MemoryRouter>
        <PlanCanvasPage
          project={project}
          planId="plan-2"
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));
    fireEvent.click(screen.getByRole('button', { name: /A-101/ }));

    expect(screen.getByText('Selected area')).toBeInTheDocument();
    expect(
      screen.getByText(/Draw a crop rectangle inside the selected measured area/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save crop' })).toBeDisabled();
  });
});
