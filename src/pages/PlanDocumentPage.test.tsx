import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../types';
import { PlanDocumentPage } from './PlanDocumentPage';

const project: Project = {
  id: 'project-1',
  ownerUid: 'user-1',
  name: 'Hotel Renovation',
  clientName: 'Client',
  companyName: 'Studio',
  projectLocation: 'Seattle',
  budgetMode: 'shared',
  budgetCents: 0,
  ffeBudgetCents: 0,
  proposalBudgetCents: 0,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2026-05-01T00:00:00Z',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-06T00:00:00Z',
};

vi.mock('../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks')>();
  return {
    ...actual,
    usePlanDocument: vi.fn(() => ({
      isLoading: false,
      data: {
        document: {
          id: 'document-1',
          projectId: 'project-1',
          ownerUid: 'user-1',
          name: 'Issued Architectural Set',
          sourceType: 'pdf',
          sourceFilename: 'issued-set.pdf',
          sourceContentType: 'application/pdf',
          sourceByteSize: 4096,
          sourceR2Key: 'users/user-1/projects/project-1/plan-documents/document-1/source.pdf',
          coverMeasuredPlanId: 'plan-1',
          sheetCount: 2,
          calibratedSheetCount: 1,
          measurementCount: 3,
          coverSheet: null,
          createdAt: '2026-05-06T00:00:00Z',
          updatedAt: '2026-05-07T12:00:00Z',
        },
        sheets: [
          {
            id: 'plan-1',
            projectId: 'project-1',
            ownerUid: 'user-1',
            planDocumentId: 'document-1',
            sheetIndex: 1,
            pageLabel: '1',
            name: 'Level 1 Furniture Plan',
            sheetReference: 'A1.1',
            sourceType: 'pdf-page',
            imageFilename: 'level-1.png',
            imageContentType: 'image/png',
            imageByteSize: 1024,
            pdfFilename: 'issued-set.pdf',
            pdfContentType: 'application/pdf',
            pdfByteSize: 4096,
            pdfPageNumber: 1,
            pdfPageWidthPt: 612,
            pdfPageHeightPt: 792,
            pdfRenderScale: 2,
            pdfRenderedWidthPx: 1224,
            pdfRenderedHeightPx: 1584,
            pdfRotation: 0,
            calibrationStatus: 'calibrated',
            measurementCount: 3,
            createdAt: '2026-05-06T00:00:00Z',
            updatedAt: '2026-05-06T00:00:00Z',
          },
          {
            id: 'plan-2',
            projectId: 'project-1',
            ownerUid: 'user-1',
            planDocumentId: 'document-1',
            sheetIndex: 2,
            pageLabel: '2',
            name: 'Level 2 Furniture Plan',
            sheetReference: 'A1.2',
            sourceType: 'pdf-page',
            imageFilename: 'level-2.png',
            imageContentType: 'image/png',
            imageByteSize: 2048,
            pdfFilename: 'issued-set.pdf',
            pdfContentType: 'application/pdf',
            pdfByteSize: 4096,
            pdfPageNumber: 2,
            pdfPageWidthPt: 612,
            pdfPageHeightPt: 792,
            pdfRenderScale: 2,
            pdfRenderedWidthPx: 1224,
            pdfRenderedHeightPx: 1584,
            pdfRotation: 0,
            calibrationStatus: 'uncalibrated',
            measurementCount: 0,
            createdAt: '2026-05-06T00:00:00Z',
            updatedAt: '2026-05-06T00:00:00Z',
          },
        ],
      },
    })),
  };
});

describe('PlanDocumentPage', () => {
  it('renders document summary and sheet links', () => {
    render(
      <MemoryRouter>
        <PlanDocumentPage project={project} documentId="document-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Issued Architectural Set')).toBeInTheDocument();
    expect(screen.getByText('issued-set.pdf · Updated May 7, 2026')).toBeInTheDocument();
    expect(screen.getByText('A1.1')).toBeInTheDocument();
    expect(screen.getByText('A1.2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Level 1 Furniture Plan' })).toHaveAttribute(
      'href',
      '/projects/project-1/plans/plan-1',
    );
    expect(screen.getAllByRole('link', { name: 'Open sheet' })[1]).toHaveAttribute(
      'href',
      '/projects/project-1/plans/plan-2',
    );
  });
});
