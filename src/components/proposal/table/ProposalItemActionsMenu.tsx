import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { GeneratedItemActionTrigger } from '../../shared/table/GeneratedItemActionControls';
import { cn } from '../../../lib/utils';
import { DeleteItemModal } from './DeleteItemModal';
import { menuItemClassName } from './proposalTableConstants';

type ProposalItemActionsMenuProps = {
  itemName: string;
  otherCategories: { id: string; name: string }[];
  onViewDetails: () => void;
  onDuplicate: () => void;
  onAddToFfe: () => void;
  onMove: (toCategoryId: string) => void;
  onDelete: () => void;
};

export function ProposalItemActionsMenu({
  itemName,
  otherCategories,
  onViewDetails,
  onDuplicate,
  onAddToFfe,
  onMove,
  onDelete,
}: ProposalItemActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moveTriggerRef = useRef<HTMLButtonElement>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: globalThis.MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(event.target as Node) ?? false;
      const inMenu = menuRef.current?.contains(event.target as Node) ?? false;
      const inMoveMenu = moveMenuRef.current?.contains(event.target as Node) ?? false;
      if (!inTrigger && !inMenu && !inMoveMenu) {
        setOpen(false);
        setMoveOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    setMoveOpen(false);
    action();
  };

  const menuRect = triggerRef.current?.getBoundingClientRect();

  return (
    <div className="inline-flex">
      <GeneratedItemActionTrigger
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open options for ${itemName}`}
        title={`Open options for ${itemName}`}
        onClick={() => setOpen((current) => !current)}
      />
      {open &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: menuRect.bottom + 4,
              right: window.innerWidth - menuRect.right,
            }}
            className="z-[100] min-w-48 menu-panel"
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onViewDetails)}
            >
              View details
            </button>
            <div className="my-1 h-px bg-neutral-100" />
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onDuplicate)}
            >
              Duplicate
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onAddToFfe)}
            >
              Add to FF&amp;E
            </button>
            {otherCategories.length > 0 && (
              <div className="relative">
                <button
                  ref={moveTriggerRef}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={moveOpen}
                  className={menuItemClassName}
                  onClick={() => setMoveOpen((v) => !v)}
                >
                  Move to...
                  <span className="ml-auto text-xs text-neutral-400">{'>'}</span>
                </button>
                {moveOpen &&
                  moveTriggerRef.current &&
                  createPortal(
                    <div
                      ref={moveMenuRef}
                      role="menu"
                      style={{
                        position: 'fixed',
                        top: moveTriggerRef.current.getBoundingClientRect().top,
                        right:
                          window.innerWidth -
                          moveTriggerRef.current.getBoundingClientRect().left +
                          4,
                      }}
                      className="z-[100] min-w-40 menu-panel"
                    >
                      {otherCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          role="menuitem"
                          className={menuItemClassName}
                          onClick={() => runAction(() => onMove(cat.id))}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )}
              </div>
            )}
            <div className="my-1 h-px bg-neutral-100" />
            <button
              type="button"
              role="menuitem"
              className={cn(menuItemClassName, 'text-danger-600')}
              onClick={() => runAction(() => setDeleteOpen(true))}
            >
              Delete item
            </button>
          </div>,
          document.body,
        )}
      <DeleteItemModal
        open={deleteOpen}
        itemName={itemName}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          onDelete();
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}
