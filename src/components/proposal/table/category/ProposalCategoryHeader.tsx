import { cents, formatMoney, type CustomColumnDef } from '../../../../types';
import { InlineTextEdit } from '../../../primitives/InlineTextEdit';
import { Badge } from '../../../primitives';
import {
  DropdownMenu,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubTrigger,
} from '../../../primitives';
import { cn } from '../../../../lib/utils';
import { ColumnsPanel } from '../../../shared/table/ColumnsPanel';
import { ColumnGroupTabs } from '../../../shared/table/ColumnGroupTabs';
import { ColumnNavArrows, GroupedTableHeader } from '../../../shared/table/TableViewWrappers';
import { PROPOSAL_GENERATED_ITEM_TABLE_PRESET } from '../../../../lib/table/generatedItemTablePresets';

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
  activeColumnGroup: string;
  onActiveColumnGroupChange: (groupId: string) => void;
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
  activeColumnGroup,
  onActiveColumnGroupChange,
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
        <Badge variant="neutral" size="md" className="shrink-0">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Badge>
        {hasOpenRevision && openRevisionLabel && (
          <Badge variant="brand" size="md" className="shrink-0">
            Revision {openRevisionLabel}
          </Badge>
        )}
        {!collapsed && !isMobile && (
          <ColumnGroupTabs
            groups={PROPOSAL_GENERATED_ITEM_TABLE_PRESET.columnGroups}
            activeGroupId={activeColumnGroup}
            onChange={onActiveColumnGroupChange}
          />
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
          className="text-link shrink-0 gap-1 text-xs font-semibold text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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
  return (
    <DropdownMenu
      panelClassName="z-[100] min-w-52"
      renderTrigger={({ triggerRef, open, toggleMenu }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Open category actions for ${categoryName}`}
          title={`Open category actions for ${categoryName}`}
          className="icon-btn"
          onClick={toggleMenu}
        >
          <MoreIcon />
        </button>
      )}
    >
      {({
        closeMenu,
        submenuOpen,
        toggleSubmenu,
        submenuTriggerRef,
        submenuPanelRef,
        getSubmenuPosition,
      }) => (
        <>
          {!collapsed && (
            <>
              <MenuItem
                onClick={() => {
                  closeMenu();
                  onExpand();
                }}
              >
                Expand table view
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem
            onClick={() => {
              closeMenu();
              onAddItem();
            }}
          >
            Add item
          </MenuItem>
          <MenuSubTrigger
            ref={submenuTriggerRef}
            aria-expanded={submenuOpen}
            className="justify-between"
            onClick={toggleSubmenu}
          >
            Restore or add columns
            <ChevronIcon direction="right" />
          </MenuSubTrigger>
          <MenuSub
            open={submenuOpen}
            panelRef={submenuPanelRef}
            position={getSubmenuPosition({ align: 'top', edge: 'left', offsetX: -4 })}
            className="z-[100] min-w-44"
          >
            {hiddenDefaults.map((col) => (
              <MenuItem
                key={col.id}
                onClick={() => {
                  closeMenu();
                  onRestoreDefault(col.id);
                }}
              >
                {col.label}
              </MenuItem>
            ))}
            {hiddenDefaults.length > 0 && <MenuSeparator />}
            <MenuItem
              onClick={() => {
                closeMenu();
                onOpenAddColumnModal();
              }}
            >
              Add custom column...
            </MenuItem>
          </MenuSub>
          <MenuSeparator />
          <MenuItem
            className={cn('text-danger-600 hover:bg-red-50 hover:text-danger-700')}
            onClick={() => {
              closeMenu();
              onCategoryDelete();
            }}
          >
            Delete category
          </MenuItem>
        </>
      )}
    </DropdownMenu>
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
