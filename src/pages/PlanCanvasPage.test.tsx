import { render, screen } from '@testing-library/react';
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
        <PlanCanvasPage project={project} planId="plan-1" />
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
        <PlanCanvasPage project={project} planId="plan-2" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Saved scale')).toBeInTheDocument();
    expect(screen.getAllByText(/12 ft/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Length Line' })).toBeEnabled();
    expect(screen.getByText('Banquette wall')).toBeInTheDocument();
  });
});
