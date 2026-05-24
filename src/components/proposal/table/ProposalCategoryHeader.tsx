import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { cents, formatMoney } from '../../../types';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { cn } from '../../../lib/utils';
import { ColumnNavArrows, GroupedTableHeader } from '../../shared/table/TableViewWrappers';
import { menuItemClassName } from './proposalTableConstants';

type ProposalCategoryHeaderProps = {
  categoryName: string;
  itemCount: number;
  collapsed: boolean;
  isMobile: boolean;
  subtotalCents: number;
  hasOpenRevision: boolean;
  openRevisionLabel?: string | undefined;
  hiddenDefaults: { id: string; label: string }[];
  onToggle: () => void;
  onPrefetchItems: () => void;
  onCategoryNameSave: (name: string) => void;
  onCategoryDelete: () => void;
  onAddItem: () => void;
  onRestoreDefault: (id: string) => void;
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
  hiddenDefaults,
  onToggle,
  onPrefetchItems,
  onCategoryNameSave,
  onCategoryDelete,
  onAddItem,
  onRestoreDefault,
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
  const [open, setOpen] = useState(false);
  const [columnSubmenuOpen, setColumnSubmenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const columnTriggerRef = useRef<HTMLButtonElement>(null);
  const columnSubmenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: globalThis.MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(event.target as Node) ?? false;
      const inMenu = menuRef.current?.contains(event.target as Node) ?? false;
      const inSubmenu = columnSubmenuRef.current?.contains(event.target as Node) ?? false;
      if (!inTrigger && !inMenu && !inSubmenu) {
        setOpen(false);
        setColumnSubmenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <div className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open category actions for ${categoryName}`}
        title={`Open category actions for ${categoryName}`}
        className="icon-btn"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>
      {open &&
        triggerRect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: triggerRect.bottom + 4,
              right: window.innerWidth - triggerRect.right,
            }}
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
                ref={columnTriggerRef}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={columnSubmenuOpen}
                className={menuItemClassName}
                onClick={() => setColumnSubmenuOpen((value) => !value)}
              >
                Restore or add columns
                <ChevronIcon direction="right" />
              </button>
              {columnSubmenuOpen &&
                columnTriggerRef.current &&
                createPortal(
                  <div
                    ref={columnSubmenuRef}
                    role="menu"
                    style={{
                      position: 'fixed',
                      top: columnTriggerRef.current.getBoundingClientRect().top,
                      right:
                        window.innerWidth -
                        columnTriggerRef.current.getBoundingClientRect().left +
                        4,
                    }}
                    className="z-[100] min-w-44 menu-panel"
                  >
                    {hiddenDefaults.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        role="menuitem"
                        className={menuItemClassName}
                        onClick={() => {
                          setColumnSubmenuOpen(false);
                          setOpen(false);
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
                        setColumnSubmenuOpen(false);
                        setOpen(false);
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
