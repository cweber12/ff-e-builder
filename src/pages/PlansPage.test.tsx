import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../types';
import {
  PLANS_ACTIONS_SLOT_ID,
  PLANS_FILTER_SLOT_ID,
  PLANS_OPTIONS_SLOT_ID,
  PLANS_SUMMARY_SLOT_ID,
} from './PlansPage';

vi.mock('../components/plans/list/PlanUploadModal', () => ({
  PlanUploadModal: vi.fn(({ open }: { open: boolean }) =>
    open ? <div data-testid="plan-upload-modal">Upload modal</div> : null,
  ),
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

vi.mock('../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks')>();
  return {
    ...actual,
    usePlanDocuments: vi.fn(() => ({
      data: [
        {
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
          coverSheet: {
            id: 'plan-1',
            projectId: 'project-1',
            ownerUid: 'user-1',
            planDocumentId: 'document-1',
            sheetIndex: 1,
            pageLabel: '1',
            name: 'Level 1 Furniture Plan',
            sheetReference: 'A1.1',
            sourceType: 'pdf-page',
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
            calibrationStatus: 'calibrated',
            measurementCount: 3,
            createdAt: '2026-05-06T00:00:00Z',
            updatedAt: '2026-05-06T00:00:00Z',
          },
          createdAt: '2026-05-06T00:00:00Z',
          updatedAt: '2026-05-06T00:00:00Z',
        },
      ],
      isLoading: false,
    })),
    useCreatePlanDocument: vi.fn(() => ({
      mutateAsync: createMutateAsync,
      isPending: false,
    })),
    useDeletePlanDocument: vi.fn(() => ({
      mutateAsync: deleteMutateAsync,
      isPending: false,
      variables: undefined,
    })),
  };
});

vi.mock('../lib/api', () => ({
  api: {
    plans: {
      downloadContent: vi.fn(() => Promise.resolve(new Blob(['preview']))),
    },
  },
}));

describe('PlansPage', () => {
  it('renders document cards and opens the upload modal from toolbar actions', () => {
    const slot = document.createElement('div');
    slot.id = PLANS_ACTIONS_SLOT_ID;
    document.body.appendChild(slot);

    render(
      <MemoryRouter>
        <PlansPage project={project} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Issued Architectural Set')).toBeInTheDocument();
    expect(screen.getByText('2 sheets')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-upload-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Upload plan' }));
    expect(screen.getByTestId('plan-upload-modal')).toBeInTheDocument();

    slot.remove();
  });

  it('rebinds plans sidebar portals after slots unmount and remount', async () => {
    const makeSlot = (id: string) => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
      return el;
    };

    const actionsSlot = makeSlot(PLANS_ACTIONS_SLOT_ID);
    const filterSlot = makeSlot(PLANS_FILTER_SLOT_ID);
    const optionsSlot = makeSlot(PLANS_OPTIONS_SLOT_ID);
    const summarySlot = makeSlot(PLANS_SUMMARY_SLOT_ID);

    const view = render(
      <MemoryRouter>
        <PlansPage project={project} />
      </MemoryRouter>,
    );

    expect(within(actionsSlot).getByRole('button', { name: 'Upload plan' })).toBeInTheDocument();
    expect(within(filterSlot).getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
    expect(within(filterSlot).getByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
    expect(within(optionsSlot).getByRole('button', { name: /plans options/i })).toBeInTheDocument();
    expect(within(filterSlot).queryByRole('tab', { name: 'All' })).not.toBeInTheDocument();
    expect(within(summarySlot).getByText('doc')).toBeInTheDocument();
    expect(within(summarySlot).getByText('sheets')).toBeInTheDocument();

    actionsSlot.remove();
    filterSlot.remove();
    optionsSlot.remove();
    summarySlot.remove();

    const nextActionsSlot = makeSlot(PLANS_ACTIONS_SLOT_ID);
    const nextFilterSlot = makeSlot(PLANS_FILTER_SLOT_ID);
    const nextOptionsSlot = makeSlot(PLANS_OPTIONS_SLOT_ID);
    const nextSummarySlot = makeSlot(PLANS_SUMMARY_SLOT_ID);

    view.rerender(
      <MemoryRouter>
        <PlansPage project={project} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        within(nextActionsSlot).getByRole('button', { name: 'Upload plan' }),
      ).toBeInTheDocument();
      expect(within(nextFilterSlot).getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
      expect(within(nextFilterSlot).getByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
      expect(
        within(nextOptionsSlot).getByRole('button', { name: /plans options/i }),
      ).toBeInTheDocument();
      expect(within(nextSummarySlot).getByText('doc')).toBeInTheDocument();
    });

    nextActionsSlot.remove();
    nextFilterSlot.remove();
    nextOptionsSlot.remove();
    nextSummarySlot.remove();
  });
});
