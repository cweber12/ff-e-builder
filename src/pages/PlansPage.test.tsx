import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../types';

vi.mock('../components/plans/PlanUploadPanel', () => ({
  PlanUploadPanel: vi.fn(() => <aside data-testid="plan-upload-panel">Upload panel</aside>),
}));

import { PlansPage } from './PlansPage';

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

const createMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();

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
    ],
    isLoading: false,
  })),
  useCreateMeasuredPlan: vi.fn(() => ({
    mutateAsync: createMutateAsync,
    isPending: false,
  })),
  useDeleteMeasuredPlan: vi.fn(() => ({
    mutateAsync: deleteMutateAsync,
    isPending: false,
    variables: undefined,
  })),
}));

vi.mock('../lib/api', () => ({
  api: {
    plans: {
      downloadContent: vi.fn(() => Promise.resolve(new Blob(['preview']))),
    },
  },
}));

describe('PlansPage', () => {
  it('renders the plans library and upload panel', () => {
    render(
      <MemoryRouter>
        <PlansPage project={project} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Architectural plan library')).toBeInTheDocument();
    expect(screen.getByText('Level 1 Furniture Plan')).toBeInTheDocument();
    expect(screen.getByTestId('plan-upload-panel')).toBeInTheDocument();
  });
});
