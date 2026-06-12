import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../types';
import { PlanDocumentPage } from './PlanDocumentPage';

const updateDocumentMutateAsync = vi.fn();

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
    useUpdatePlanDocument: vi.fn(() => ({
      mutateAsync: updateDocumentMutateAsync,
      isPending: false,
      variables: undefined,
    })),
  };
});

describe('PlanDocumentPage', () => {
  beforeEach(() => {
    updateDocumentMutateAsync.mockReset();
    updateDocumentMutateAsync.mockResolvedValue(undefined);
  });

  it('renders document summary and sheet links', () => {
    render(
      <MemoryRouter>
        <PlanDocumentPage project={project} documentId="document-1" />
      </MemoryRouter>,
    );

    expect(screen.getByDisplayValue('Issued Architectural Set')).toBeInTheDocument();
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
    expect(screen.getByText('Cover')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Set Level 2 Furniture Plan as cover sheet' }),
    ).toBeInTheDocument();
  });

  it('saves document name edits', async () => {
    render(
      <MemoryRouter>
        <PlanDocumentPage project={project} documentId="document-1" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Document name'), {
      target: { value: 'Architectural Set - Revision 2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document name' }));

    await waitFor(() => {
      expect(updateDocumentMutateAsync).toHaveBeenCalledWith({
        name: 'Architectural Set - Revision 2',
      });
    });
  });

  it('sets a sheet as the document cover', async () => {
    render(
      <MemoryRouter>
        <PlanDocumentPage project={project} documentId="document-1" />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Set Level 2 Furniture Plan as cover sheet' }),
    );

    await waitFor(() => {
      expect(updateDocumentMutateAsync).toHaveBeenCalledWith({
        coverMeasuredPlanId: 'plan-2',
      });
    });
  });
});
