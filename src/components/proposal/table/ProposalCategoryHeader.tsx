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
          className="shrink-0 rounded px-1 text-xs text-brand-100 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80"
        >
          <ChevronIcon direction={collapsed ? 'right' : 'down'} />
        </button>
        <InlineTextEdit
          value={categoryName}
          onSave={onCategoryNameSave}
          aria-label="Category name"
          renderDisplay={(value) => (
            <span className="truncate text-sm font-semibold tracking-tight text-white">
              {value}
            </span>
          )}
          inputClassName="text-sm font-semibold text-neutral-950 border-neutral-300 bg-white"
        />
        <span className="shrink-0 rounded-pill bg-white/15 px-2 py-0.5 text-xs font-medium text-brand-50 ring-1 ring-inset ring-white/15">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        <button
          type="button"
          onClick={onAddItem}
          title={`Add item to ${categoryName}`}
          aria-label={`Add item to ${categoryName}`}
          className="shrink-0 inline-flex items-center gap-1 rounded-pill bg-white/10 px-2 py-0.5 text-xs font-medium text-brand-50 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80"
        >
          <span aria-hidden="true" className="text-sm leading-none">
            +
          </span>
          Add item
        </button>
        {hasOpenRevision && openRevisionLabel && (
          <span className="shrink-0 rounded-pill bg-brand-500/25 px-2 py-0.5 text-xs font-medium text-brand-100 ring-1 ring-inset ring-brand-300/50">
            Revision {openRevisionLabel}
          </span>
        )}
      </div>
      <div className="sticky right-4 flex items-center gap-2 [&_.icon-btn]:text-brand-100 [&_.icon-btn:hover]:bg-white/10 [&_.icon-btn:hover]:text-white">
        {!collapsed && !isMobile && <ColumnNavArrows />}
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-white">
          {formatMoney(cents(subtotalCents))}
        </span>
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
          triggerClassName="text-brand-100 ring-white/15 border-white/15 bg-white/10 hover:bg-white/20"
        />
        <CategoryActionsMenu
          categoryName={categoryName}
          hiddenDefaults={hiddenDefaults}
          onCategoryDelete={onCategoryDelete}
          onAddItem={onAddItem}
          onRestoreDefault={onRestoreDefault}
          onOpenAddColumnModal={onOpenAddColumnModal}
        />
        {!collapsed && (
          <button
            type="button"
            aria-label="Expand table view"
            title="Expand table view"
            onClick={onExpand}
            className="icon-btn"
          >
            <ExpandIcon />
          </button>
        )}
      </div>
    </GroupedTableHeader>
  );
}

type CategoryActionsMenuProps = {
  categoryName: string;
  hiddenDefaults: { id: string; label: string }[];
  onCategoryDelete: () => void;
  onAddItem: () => void;
  onRestoreDefault: (id: string) => void;
  onOpenAddColumnModal: () => void;
};

function CategoryActionsMenu({
  categoryName,
  hiddenDefaults,
  onCategoryDelete,
  onAddItem,
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

function ExpandIcon({ expanded }: { expanded?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      {expanded ? (
        <path
          d="M7.5 4.5v4h-4m9 7v-4h4M7.5 8.5 3.5 4.5m9 7 4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 4H4v4m8-4h4v4M8 16H4v-4m8 4h4v-4M4.5 4.5 8 8m7.5-3.5L12 8m-7.5 7.5L8 12m7.5 3.5L12 12"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
