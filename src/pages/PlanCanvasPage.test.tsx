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
  });
});
