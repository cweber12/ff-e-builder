import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProposalCategoryHeader } from './ProposalCategoryHeader';

describe('ProposalCategoryHeader', () => {
  it('switches schedules from the compact record-mode dropdown', async () => {
    const user = userEvent.setup();
    const onActiveCategoryChange = vi.fn();

    render(
      <ProposalCategoryHeader
        layoutMode="records"
        categoryName="Furniture"
        scheduleOptions={[
          { id: 'furniture', name: 'Furniture', itemCount: 44, subtotalCents: 3309800 },
          { id: 'lighting', name: 'Lighting', itemCount: 12, subtotalCents: 410000 },
        ]}
        activeCategoryId="furniture"
        onActiveCategoryChange={onActiveCategoryChange}
        itemCount={44}
        collapsed={false}
        isCompact={false}
        subtotalCents={3309800}
        hasOpenRevision
        openRevisionLabel="1.2"
        revisionMode
        visibleColumns={[]}
        hiddenDefaults={[]}
        customColumnDefs={[]}
        activeColumnGroup="all"
        onActiveColumnGroupChange={vi.fn()}
        onToggle={vi.fn()}
        onPrefetchItems={vi.fn()}
        onCategoryNameSave={vi.fn()}
        onCategoryDelete={vi.fn()}
        onAddItem={vi.fn()}
        onAddAllToFfe={vi.fn()}
        addableToFfeCount={0}
        onMoveColumn={vi.fn()}
        onHideColumn={vi.fn()}
        onRestoreDefault={vi.fn()}
        onRenameCustomColumn={vi.fn(() => Promise.resolve())}
        onDeleteCustomColumn={vi.fn()}
        onOpenAddColumnModal={vi.fn()}
        onExpand={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Select active schedule' }));
    await user.click(screen.getByRole('menuitem', { name: /Lighting/i }));

    expect(onActiveCategoryChange).toHaveBeenCalledWith('lighting');
  });

  it('hides the record-mode revision label until revision mode is enabled', () => {
    const { rerender } = render(
      <ProposalCategoryHeader
        layoutMode="records"
        categoryName="Furniture"
        scheduleOptions={[]}
        itemCount={44}
        collapsed={false}
        isCompact={false}
        subtotalCents={3309800}
        hasOpenRevision
        openRevisionLabel="1.2"
        visibleColumns={[]}
        hiddenDefaults={[]}
        customColumnDefs={[]}
        activeColumnGroup="all"
        onActiveColumnGroupChange={vi.fn()}
        onToggle={vi.fn()}
        onPrefetchItems={vi.fn()}
        onCategoryNameSave={vi.fn()}
        onCategoryDelete={vi.fn()}
        onAddItem={vi.fn()}
        onAddAllToFfe={vi.fn()}
        addableToFfeCount={0}
        onMoveColumn={vi.fn()}
        onHideColumn={vi.fn()}
        onRestoreDefault={vi.fn()}
        onRenameCustomColumn={vi.fn(() => Promise.resolve())}
        onDeleteCustomColumn={vi.fn()}
        onOpenAddColumnModal={vi.fn()}
        onExpand={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Revision 1.2 compare/i)).not.toBeInTheDocument();

    rerender(
      <ProposalCategoryHeader
        layoutMode="records"
        categoryName="Furniture"
        scheduleOptions={[]}
        itemCount={44}
        collapsed={false}
        isCompact={false}
        subtotalCents={3309800}
        hasOpenRevision
        openRevisionLabel="1.2"
        revisionMode
        visibleColumns={[]}
        hiddenDefaults={[]}
        customColumnDefs={[]}
        activeColumnGroup="all"
        onActiveColumnGroupChange={vi.fn()}
        onToggle={vi.fn()}
        onPrefetchItems={vi.fn()}
        onCategoryNameSave={vi.fn()}
        onCategoryDelete={vi.fn()}
        onAddItem={vi.fn()}
        onAddAllToFfe={vi.fn()}
        addableToFfeCount={0}
        onMoveColumn={vi.fn()}
        onHideColumn={vi.fn()}
        onRestoreDefault={vi.fn()}
        onRenameCustomColumn={vi.fn(() => Promise.resolve())}
        onDeleteCustomColumn={vi.fn()}
        onOpenAddColumnModal={vi.fn()}
        onExpand={vi.fn()}
      />,
    );

    expect(screen.getByText(/Revision 1.2 compare/i)).toBeInTheDocument();
  });
});
