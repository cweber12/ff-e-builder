import { createPortal } from 'react-dom';
import { cents, formatMoney, type CustomColumnDef } from '../../../types';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { cn } from '../../../lib/utils';
import { ColumnsPanel } from '../../shared/table/ColumnsPanel';
import { ColumnNavArrows, GroupedTableHeader } from '../../shared/table/TableViewWrappers';
import { menuItemClassName } from './proposalTableConstants';
import { useActionsMenu } from '../../../hooks';

type ProposalCategoryHeaderProps = {
  categoryName: string;
  itemCount: number;
  collapsed: boolean;
  isMobile: boolean;
  subtotalCents: number;
  hasOpenRevision: boolean;
  openRevisionLabel?: string | undefined;
  visibleColumns: { id: string; label: string; isCustom?: boolean }[];
  hiddenDefaults: { id: string; label: string }[];
  customColumnDefs: CustomColumnDef[];
  onToggle: () => void;
  onPrefetchItems: () => void;
  onCategoryNameSave: (name: string) => void;
  onCategoryDelete: () => void;
  onAddItem: () => void;
  onMoveColumn: (fromId: string, toId: string) => void;
  onHideColumn: (id: string) => void;
  onRestoreDefault: (id: string) => void;
  onRenameCustomColumn: (defId: string, label: string) => Promise<void>;
  onDeleteCustomColumn: (defId: string) => void;
  onOpenAddColumnModal: () => void;
  onExpand: () => void;
};

export function ProposalCategoryHeader({
  categoryName,
  itemCount,
  collapsed,
  isMobile,
  subtotalCents,
  hasOpenRevision,
  openRevisionLabel,
  visibleColumns,
  hiddenDefaults,
  customColumnDefs,
  onToggle,
  onPrefetchItems,
  onCategoryNameSave,
  onCategoryDelete,
  onAddItem,
  onMoveColumn,
  onHideColumn,
  onRestoreDefault,
  onRenameCustomColumn,
  onDeleteCustomColumn,
  onOpenAddColumnModal,
  onExpand,
}: ProposalCategoryHeaderProps) {
  return (
    <GroupedTableHeader>
      <div className="sticky left-4 flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          onMouseEnter={collapsed ? onPrefetchItems : undefined}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${categoryName}`}
          title={`${collapsed ? 'Expand' : 'Collapse'} ${categoryName}`}
          className="shrink-0 rounded px-1 text-xs text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <ChevronIcon direction={collapsed ? 'right' : 'down'} />
        </button>
        <InlineTextEdit
          value={categoryName}
          onSave={onCategoryNameSave}
          aria-label="Category name"
          renderDisplay={(value) => (
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-900">
              {value}
            </span>
          )}
          inputClassName="text-sm font-semibold text-neutral-950 border-neutral-300 bg-white"
        />
        <span className="shrink-0 rounded-pill bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-black/10">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        {hasOpenRevision && openRevisionLabel && (
          <span className="shrink-0 rounded-pill bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200/50">
            Revision {openRevisionLabel}
          </span>
        )}
      </div>
      <div className="sticky right-4 flex items-center gap-2">
        {!collapsed && !isMobile && <ColumnNavArrows />}
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-neutral-700">
          {formatMoney(cents(subtotalCents))}
        </span>
        <button
          type="button"
          onClick={onAddItem}
          title={`Add item to ${categoryName}`}
          aria-label={`Add item to ${categoryName}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-300 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <span aria-hidden="true" className="text-sm leading-none">
            +
          </span>
          Add item
        </button>
        <ColumnsPanel
          title={categoryName}
          visibleColumns={visibleColumns}
          hiddenDefaults={hiddenDefaults}
          customColumns={customColumnDefs}
          onMoveColumn={onMoveColumn}
          onHideColumn={onHideColumn}
          onRestoreDefault={onRestoreDefault}
          onRenameCustomColumn={onRenameCustomColumn}
          onDeleteCustomColumn={onDeleteCustomColumn}
          onOpenAddColumnModal={onOpenAddColumnModal}
        />
        <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CategoryActionsMenu
            categoryName={categoryName}
            collapsed={collapsed}
            hiddenDefaults={hiddenDefaults}
            onCategoryDelete={onCategoryDelete}
            onAddItem={onAddItem}
            onExpand={onExpand}
            onRestoreDefault={onRestoreDefault}
            onOpenAddColumnModal={onOpenAddColumnModal}
          />
        </span>
      </div>
    </GroupedTableHeader>
  );
}

type CategoryActionsMenuProps = {
  categoryName: string;
  collapsed: boolean;
  hiddenDefaults: { id: string; label: string }[];
  onCategoryDelete: () => void;
  onAddItem: () => void;
  onExpand: () => void;
  onRestoreDefault: (id: string) => void;
  onOpenAddColumnModal: () => void;
};

function CategoryActionsMenu({
  categoryName,
  collapsed,
  hiddenDefaults,
  onCategoryDelete,
  onAddItem,
  onExpand,
  onRestoreDefault,
  onOpenAddColumnModal,
}: CategoryActionsMenuProps) {
  const actionsMenu = useActionsMenu();

  const runAction = (action: () => void) => {
    actionsMenu.closeMenu();
    action();
  };

  const menuPosition = actionsMenu.getPortalPosition(actionsMenu.triggerRef);
  const submenuPosition = actionsMenu.getPortalPosition(actionsMenu.submenuTriggerRef, {
    align: 'top',
    edge: 'left',
    offsetX: -4,
  });

  return (
    <div className="inline-flex">
      <button
        ref={actionsMenu.triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={actionsMenu.open}
        aria-label={`Open category actions for ${categoryName}`}
        title={`Open category actions for ${categoryName}`}
        className="icon-btn"
        onClick={actionsMenu.toggleMenu}
      >
        <MoreIcon />
      </button>
      {actionsMenu.open &&
        menuPosition &&
        createPortal(
          <div
            ref={actionsMenu.panelRef}
            role="menu"
            style={menuPosition}
            className="z-[100] min-w-52 menu-panel"
          >
            {!collapsed && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClassName}
                  onClick={() => runAction(onExpand)}
                >
                  Expand table view
                </button>
                <div className="my-1 h-px bg-neutral-100" />
              </>
            )}
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onAddItem)}
            >
              Add item
            </button>
            <div className="relative">
              <button
                ref={actionsMenu.submenuTriggerRef}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={actionsMenu.submenuOpen}
                className={menuItemClassName}
                onClick={actionsMenu.toggleSubmenu}
              >
                Restore or add columns
                <ChevronIcon direction="right" />
              </button>
              {actionsMenu.submenuOpen &&
                submenuPosition &&
                createPortal(
                  <div
                    ref={actionsMenu.submenuPanelRef}
                    role="menu"
                    style={submenuPosition}
                    className="z-[100] min-w-44 menu-panel"
                  >
                    {hiddenDefaults.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        role="menuitem"
                        className={menuItemClassName}
                        onClick={() => {
                          actionsMenu.closeMenu();
                          onRestoreDefault(col.id);
                        }}
                      >
                        {col.label}
                      </button>
                    ))}
                    {hiddenDefaults.length > 0 && <div className="my-1 h-px bg-neutral-100" />}
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClassName}
                      onClick={() => {
                        actionsMenu.closeMenu();
                        onOpenAddColumnModal();
                      }}
                    >
                      Add custom column...
                    </button>
                  </div>,
                  document.body,
                )}
            </div>
            <div className="my-1 h-px bg-neutral-100" />
            <button
              type="button"
              role="menuitem"
              className={cn(menuItemClassName, 'text-danger-600')}
              onClick={() => runAction(onCategoryDelete)}
            >
              Delete category
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ChevronIcon({ direction = 'down' }: { direction?: 'down' | 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn(
        'h-4 w-4 transition-transform',
        direction === 'left' && 'rotate-90',
        direction === 'right' && '-rotate-90',
      )}
    >
      <path
        d="m5.5 8 4.5 4.5L14.5 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
    </svg>
  );
}
