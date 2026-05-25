import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProposalExportModal } from './ProposalExportModal';
import type { ProposalCategoryWithItems, Project } from '../../../types';

const { mockExportPdf, mockExportExcel, mockExportCsv } = vi.hoisted(() => ({
  mockExportPdf: vi.fn().mockResolvedValue(undefined),
  mockExportExcel: vi.fn().mockResolvedValue(undefined),
  mockExportCsv: vi.fn(),
}));

vi.mock('../../../lib/export', () => ({
  exportProposalPdf: mockExportPdf,
  exportProposalExcel: mockExportExcel,
  exportProposalCsv: mockExportCsv,
}));

const project: Project = {
  id: 'proj-1',
  ownerUid: 'u1',
  name: 'Test Project',
  clientName: 'Client',
  companyName: 'Studio',
  projectLocation: 'NY',
  budgetMode: 'individual',
  budgetCents: 0,
  proposalBudgetCents: 0,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const makeCategory = (id: string, name: string): ProposalCategoryWithItems => ({
  id,
  projectId: 'proj-1',
  name,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  items: [],
});

const categories = [
  makeCategory('cat-1', 'Living Room'),
  makeCategory('cat-2', 'Bedroom'),
  makeCategory('cat-3', 'Kitchen'),
];

const revisionData = { revisions: [], snapshots: [], changelog: [] };

function renderModal(onClose = vi.fn()) {
  return render(
    <ProposalExportModal
      open={true}
      onClose={onClose}
      project={project}
      categoriesWithItems={categories}
      userProfile={null}
      customColumnDefs={[]}
      revisionData={revisionData}
      visibleOrder={[]}
    />,
  );
}

describe('ProposalExportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders format picker and all categories checked by default', () => {
    renderModal();
    expect(screen.getByRole('radio', { name: 'PDF' })).toHaveAttribute('aria-checked', 'true');
    categories.forEach((c) => {
      expect(screen.getByLabelText(c.name)).toBeChecked();
    });
  });

  it('Export button is disabled when no categories are selected', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    expect(screen.getByText(/select at least one category/i)).toBeInTheDocument();
  });

  it('calls exportProposalPdf with separated mode when selected', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /separated/i }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(mockExportPdf).toHaveBeenCalledWith(
      project,
      categories,
      null,
      { mode: 'separated' },
      [],
      [],
    );
  });

  it('calls exportProposalPdf with continuous mode by default', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(mockExportPdf).toHaveBeenCalledWith(
      project,
      categories,
      null,
      { mode: 'continuous' },
      [],
      [],
    );
  });

  it('filters categories: only selected categories are passed to the export', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByLabelText('Bedroom'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(mockExportPdf).toHaveBeenCalledWith(
      project,
      [categories[0], categories[2]],
      null,
      { mode: 'continuous' },
      [],
      [],
    );
  });

  it('switches to Excel and calls exportProposalExcel without revision data when no open revision', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('radio', { name: 'EXCEL' }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(mockExportExcel).toHaveBeenCalledWith(project, categories, null, [], undefined, []);
  });

  it('calls exportProposalCsv for CSV format with filtered categories', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('radio', { name: 'CSV' }));
    await user.click(screen.getByLabelText('Kitchen'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(mockExportCsv).toHaveBeenCalledWith(project, [categories[0], categories[1]], [], []);
  });

  it('calls onClose after a successful export', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('select-all restores all categories after partial deselection', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByLabelText('Bedroom'));
    expect(screen.getByLabelText('Bedroom')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    categories.forEach((c) => {
      expect(screen.getByLabelText(c.name)).toBeChecked();
    });
  });
});
