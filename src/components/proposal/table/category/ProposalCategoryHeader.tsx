import { cents, formatMoney, type CustomColumnDef } from '../../../../types';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
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
  onAddAllToFfe: () => void;
  addableToFfeCount: number;
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
  onAddAllToFfe,
  addableToFfeCount,
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
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <InlineTextEdit
          value={categoryName}
          onSave={onCategoryNameSave}
          aria-label="Schedule name"
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
          className="btn-add-inline shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
            onAddAllToFfe={onAddAllToFfe}
            addableToFfeCount={addableToFfeCount}
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
  onAddAllToFfe: () => void;
  addableToFfeCount: number;
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
  onAddAllToFfe,
  addableToFfeCount,
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
          aria-label={`Open schedule actions for ${categoryName}`}
          title={`Open schedule actions for ${categoryName}`}
          className="icon-btn"
          onClick={toggleMenu}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
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
          <MenuItem
            disabled={addableToFfeCount <= 0}
            onClick={() => {
              closeMenu();
              onAddAllToFfe();
            }}
          >
            Add all to FF&amp;E
          </MenuItem>
          <MenuSubTrigger
            ref={submenuTriggerRef}
            aria-expanded={submenuOpen}
            className="justify-between"
            onClick={toggleSubmenu}
          >
            Restore or add columns
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
            Delete schedule
          </MenuItem>
        </>
      )}
    </DropdownMenu>
  );
}
