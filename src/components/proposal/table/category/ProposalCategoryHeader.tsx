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
  layoutMode?: 'records' | 'table';
  categoryName: string;
  scheduleOptions?: { id: string; name: string; itemCount: number; subtotalCents: number }[];
  activeCategoryId?: string;
  onActiveCategoryChange?: (categoryId: string) => void;
  itemCount: number;
  collapsed: boolean;
  isCompact: boolean;
  subtotalCents: number;
  hasOpenRevision: boolean;
  openRevisionLabel?: string | undefined;
  revisionMode?: boolean;
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
  layoutMode = 'table',
  categoryName,
  scheduleOptions = [],
  activeCategoryId,
  onActiveCategoryChange,
  itemCount,
  collapsed,
  isCompact,
  subtotalCents,
  hasOpenRevision,
  openRevisionLabel,
  revisionMode = false,
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
  const showTableControls = layoutMode === 'table';
  const recordMode = layoutMode === 'records';
  if (recordMode) {
    return (
      <div className="flex flex-col gap-3 border-b border-neutral-200 bg-canvas-chrome px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
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
          <CompactScheduleSelect
            categories={scheduleOptions}
            activeCategoryId={activeCategoryId ?? null}
            fallbackName={categoryName}
            onSelect={onActiveCategoryChange}
            fullWidth={isCompact}
          />
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
          {revisionMode && hasOpenRevision && openRevisionLabel ? (
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-brand-700">
              Revision {openRevisionLabel} compare
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          <div className="flex shrink-0 items-baseline justify-between gap-2 rounded-sm border border-neutral-200 bg-white px-3 py-1.5 sm:justify-start">
            <span className="eyebrow text-neutral-500">Schedule total</span>
            <span className="num text-sm font-semibold text-neutral-800">
              {formatMoney(cents(subtotalCents))}
            </span>
          </div>
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
          <CategoryActionsMenu
            layoutMode={layoutMode}
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
        </div>
      </div>
    );
  }

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
        {revisionMode && hasOpenRevision && openRevisionLabel ? (
          <Badge variant="brand" size="md" className="shrink-0">
            Revision {openRevisionLabel}
          </Badge>
        ) : null}
        {!collapsed && !isCompact && showTableControls && (
          <ColumnGroupTabs
            groups={PROPOSAL_GENERATED_ITEM_TABLE_PRESET.columnGroups}
            activeGroupId={activeColumnGroup}
            onChange={onActiveColumnGroupChange}
          />
        )}
      </div>
      <div className="sticky right-4 flex items-center gap-2">
        {!collapsed && !isCompact && showTableControls && <ColumnNavArrows />}
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
        {showTableControls ? (
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
        ) : null}
        <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CategoryActionsMenu
            layoutMode={layoutMode}
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
  layoutMode: 'records' | 'table';
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
  layoutMode,
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
  const showTableControls = layoutMode === 'table';
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
                Open Spreadsheet View
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
          {showTableControls ? (
            <>
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
            </>
          ) : null}
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

function CompactScheduleSelect({
  categories,
  activeCategoryId,
  fallbackName,
  onSelect,
  fullWidth = false,
}: {
  categories: { id: string; name: string; itemCount: number; subtotalCents: number }[];
  activeCategoryId: string | null;
  fallbackName: string;
  onSelect?: ((categoryId: string) => void) | undefined;
  fullWidth?: boolean;
}) {
  const activeCategory =
    categories.find((category) => category.id === activeCategoryId) ?? categories[0] ?? null;

  if (!activeCategory || !onSelect) {
    return (
      <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-neutral-900">
        {fallbackName}
      </span>
    );
  }

  return (
    <DropdownMenu
      wrapperClassName="min-w-0"
      panelClassName="z-[280] min-w-[18rem]"
      positionOptions={{ align: 'bottom', edge: 'left', offsetY: 8 }}
      renderTrigger={({ triggerRef, open, toggleMenu }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-label="Select active schedule"
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'group inline-flex min-w-0 items-center gap-2 rounded-sm border border-neutral-200 bg-white px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
            fullWidth ? 'w-full justify-between' : '',
          )}
          onClick={toggleMenu}
        >
          <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-neutral-900">
            {activeCategory.name}
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition group-hover:text-neutral-700 group-[aria-expanded='true']:rotate-180 group-[aria-expanded='true']:text-neutral-900"
            aria-hidden="true"
          />
        </button>
      )}
    >
      {({ closeMenu }) =>
        categories.map((category) => {
          const isActive = category.id === activeCategory.id;

          return (
            <MenuItem
              key={category.id}
              type="button"
              className="flex items-start justify-between gap-4"
              onClick={() => {
                closeMenu();
                onSelect(category.id);
              }}
            >
              <div className="min-w-0">
                <span
                  className={
                    isActive ? 'font-bold text-neutral-950' : 'font-medium text-neutral-800'
                  }
                >
                  {category.name}
                </span>
                <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">
                  {category.itemCount} {category.itemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="block font-mono text-xs font-semibold tabular-nums text-neutral-800">
                  {formatMoney(cents(category.subtotalCents))}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-[0.08em] text-neutral-500">
                  {isActive ? 'Current' : 'Open'}
                </span>
              </div>
            </MenuItem>
          );
        })
      }
    </DropdownMenu>
  );
}
