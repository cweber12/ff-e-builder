import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MeasuredPlanCard } from './MeasuredPlanCard';

vi.mock('../../../lib/api', () => ({
  api: {
    plans: {
      downloadContent: vi.fn(() => Promise.resolve(new Blob(['preview']))),
    },
  },
}));

const plan = {
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
  calibrationStatus: 'uncalibrated' as const,
  measurementCount: 0,
  createdAt: '2026-05-06T00:00:00Z',
  updatedAt: '2026-05-06T00:00:00Z',
};

describe('MeasuredPlanCard', () => {
  it('renders Measured Plan identity, status, and actions', () => {
    render(
      <MemoryRouter>
        <MeasuredPlanCard plan={plan} projectId="project-1" deleting={false} onDelete={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Level 1 Furniture Plan')).toBeInTheDocument();
    expect(screen.getByText('A1.1')).toBeInTheDocument();
    expect(screen.getByText('uncalibrated')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/projects/project-1/plans/plan-1',
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });
});
