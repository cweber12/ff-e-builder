import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlanDocumentCard } from './PlanDocumentCard';

vi.mock('../../../lib/api', () => ({
  api: {
    plans: {
      downloadContent: vi.fn(() => Promise.resolve(new Blob(['preview']))),
    },
  },
}));

const document = {
  id: 'document-1',
  projectId: 'project-1',
  ownerUid: 'user-1',
  name: 'Issued Architectural Set',
  sourceType: 'pdf' as const,
  sourceFilename: 'issued-set.pdf',
  sourceContentType: 'application/pdf',
  sourceByteSize: 4096,
  sourceR2Key: 'users/user-1/projects/project-1/plan-documents/document-1/source.pdf',
  coverMeasuredPlanId: 'plan-1',
  sheetCount: 2,
  calibratedSheetCount: 1,
  measurementCount: 3,
  coverSheet: {
    id: 'plan-1',
    projectId: 'project-1',
    ownerUid: 'user-1',
    planDocumentId: 'document-1',
    sheetIndex: 1,
    pageLabel: '1',
    name: 'Level 1 Furniture Plan',
    sheetReference: 'A1.1',
    sourceType: 'pdf-page' as const,
    imageFilename: 'plan.png',
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
    calibrationStatus: 'calibrated' as const,
    measurementCount: 3,
    createdAt: '2026-05-06T00:00:00Z',
    updatedAt: '2026-05-06T00:00:00Z',
  },
  createdAt: '2026-05-06T00:00:00Z',
  updatedAt: '2026-05-06T00:00:00Z',
};

describe('PlanDocumentCard', () => {
  it('renders document identity, status, and actions', () => {
    render(
      <MemoryRouter>
        <PlanDocumentCard
          document={document}
          projectId="project-1"
          deleting={false}
          onDelete={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Issued Architectural Set')).toBeInTheDocument();
    expect(screen.getByText('2 sheets')).toBeInTheDocument();
    expect(screen.getByText('1/2 calibrated')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Issued Architectural Set' })).toHaveAttribute(
      'href',
      '/projects/project-1/plans/documents/document-1',
    );
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeEnabled();
  });
});
