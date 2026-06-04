import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProposalItem } from '../../../../types';
import { ProposalCategoryExpandedTable } from './ProposalCategoryExpandedTable';

vi.mock('../../../shared/table/ColumnsPanel', () => ({
  ColumnsPanel: () => <div>Columns Panel</div>,
}));

vi.mock('../../../shared/table/ColumnGroupTabs', () => ({
  ColumnGroupTabs: () => <div>Column Groups</div>,
}));

vi.mock('../../../shared/table/TableViewWrappers', () => ({
  ColumnNavArrows: () => <div>Column Navigation</div>,
}));

vi.mock('../row/ProposalRow', () => ({
  ProposalRow: ({ item }: { item: ProposalItem }) => (
    <tr>
      <td>{item.productTag}</td>
    </tr>
  ),
}));

vi.mock('../../../shared/table/SortableColHeader', () => ({
  SortableColHeader: ({ children, label }: { children?: ReactNode; label?: string }) => (
    <th>{children ?? label}</th>
  ),
}));

vi.mock('../../../shared/table/CustomColumnHeader', () => ({
  CustomColumnHeader: ({ def }: { def: { label: string } }) => <span>{def.label}</span>,
}));

const item: ProposalItem = {
  id: 'item-1',
  categoryId: 'cat-1',
  productTag: 'F-01',
  itemName: 'Custom Table',
  plan: '',
  drawings: 'A1.03',
  location: 'Kitchen',
  description: 'Rectangular wood table with rounded corners and brushed brass base.',
  notes: '',
  sizeLabel: '72" x 36" x 30"',
  sizeMode: 'imperial',
  sizeW: '72',
  sizeD: '36',
  sizeH: '30',
  sizeUnit: 'ft/in',
  footprintLabel: '18 sq ft',
  footprintW: '72',
  footprintD: '36',
  footprintUnit: 'ft/in',
  footprintArea: 18,
  materials: [],
  cbm: 1.234,
  quantity: 2,
  quantityUnit: 'unit',
  unitCostCents: 65000,
  sortOrder: 0,
  customData: {},
  version: 1,
  createdAt: '2026-06-03T00:00:00Z',
  updatedAt: '2026-06-03T00:00:00Z',
  linkedFfeItemId: null,
};

const flaggedItem: ProposalItem = {
  ...item,
  id: 'item-2',
  productTag: 'F-02',
  itemName: 'Flagged chair',
};

describe('ProposalCategoryExpandedTable', () => {
  it('renders Spreadsheet View controls when open', () => {
    render(
      <ProposalCategoryExpandedTable
        open
        categoryName="Furniture"
        itemCount={1}
        subtotalCents={65000}
        projectId="project-1"
        otherCategories={[]}
        hasOpenRevision={false}
        openRevisionLabel={undefined}
        sensors={undefined}
        visibleColumns={[]}
        hiddenDefaults={[]}
        draggableColOrder={[]}
        visibleColOrder={[]}
        customColumnDefs={[]}
        activeColumnGroup="all"
        sortedItems={[item]}
        viewFilter="all"
        flaggedCount={0}
        dragOverInfo={null}
        pendingFocusItemId={null}
        proposalStatus="in_progress"
        onClose={vi.fn()}
        onActiveColumnGroupChange={vi.fn()}
        onRenameCustomColumn={vi.fn(() => Promise.resolve())}
        onDeleteCustomColumn={vi.fn()}
        onMoveColumn={vi.fn()}
        onHideColumn={vi.fn()}
        onRestoreDefault={vi.fn()}
        onOpenAddColumnModal={vi.fn()}
        onItemSave={vi.fn()}
        onItemDelete={vi.fn()}
        onItemDuplicate={vi.fn()}
        onItemAddToFfe={vi.fn()}
        onItemMove={vi.fn()}
        onItemClick={vi.fn()}
        onSwatchOpen={vi.fn()}
        onSwatchPaste={vi.fn(() => Promise.resolve())}
        isSwatchPastingForItem={vi.fn(() => false)}
        getMaterialFinishName={vi.fn(() => undefined)}
        onColumnDragEnd={vi.fn()}
        onRowDragOver={vi.fn()}
        onRowDragEnd={vi.fn()}
        onRowDragCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Spreadsheet View')).toBeInTheDocument();
    expect(screen.getByText('Column Groups')).toBeInTheDocument();
    expect(screen.getByText('Columns Panel')).toBeInTheDocument();
    expect(screen.getByText('Column Navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Furniture Spreadsheet View table')).toBeInTheDocument();
  });

  it('shows revision and flagged-only context when opened in flagged review mode', () => {
    render(
      <ProposalCategoryExpandedTable
        open
        categoryName="Furniture"
        itemCount={1}
        subtotalCents={65000}
        projectId="project-1"
        otherCategories={[]}
        hasOpenRevision
        openRevisionLabel="1.2"
        sensors={undefined}
        visibleColumns={[]}
        hiddenDefaults={[]}
        draggableColOrder={[]}
        visibleColOrder={[]}
        customColumnDefs={[]}
        activeColumnGroup="all"
        sortedItems={[flaggedItem]}
        viewFilter="flagged"
        flaggedCount={1}
        dragOverInfo={null}
        pendingFocusItemId={null}
        proposalStatus="in_progress"
        onClose={vi.fn()}
        onActiveColumnGroupChange={vi.fn()}
        onRenameCustomColumn={vi.fn(() => Promise.resolve())}
        onDeleteCustomColumn={vi.fn()}
        onMoveColumn={vi.fn()}
        onHideColumn={vi.fn()}
        onRestoreDefault={vi.fn()}
        onOpenAddColumnModal={vi.fn()}
        onItemSave={vi.fn()}
        onItemDelete={vi.fn()}
        onItemDuplicate={vi.fn()}
        onItemAddToFfe={vi.fn()}
        onItemMove={vi.fn()}
        onItemClick={vi.fn()}
        onSwatchOpen={vi.fn()}
        onSwatchPaste={vi.fn(() => Promise.resolve())}
        isSwatchPastingForItem={vi.fn(() => false)}
        getMaterialFinishName={vi.fn(() => undefined)}
        onColumnDragEnd={vi.fn()}
        onRowDragOver={vi.fn()}
        onRowDragEnd={vi.fn()}
        onRowDragCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Revision 1.2 in progress')).toBeInTheDocument();
    expect(screen.getByText('Flagged costs only · 1')).toBeInTheDocument();
    expect(screen.getByText('F-02')).toBeInTheDocument();
    expect(screen.queryByText('F-01')).not.toBeInTheDocument();
  });
});
