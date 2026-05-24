import { createPortal } from 'react-dom';
import { useState } from 'react';
import { GeneratedItemActionTrigger } from '../../shared/table/GeneratedItemActionControls';
import { cn } from '../../../lib/utils';
import { DeleteItemModal } from './DeleteItemModal';
import { menuItemClassName } from './proposalTableConstants';
import { useActionsMenu } from '../../../hooks';

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
  const actionsMenu = useActionsMenu();
  const [deleteOpen, setDeleteOpen] = useState(false);

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
      <GeneratedItemActionTrigger
        ref={actionsMenu.triggerRef}
        aria-haspopup="menu"
        aria-expanded={actionsMenu.open}
        aria-label={`Open options for ${itemName}`}
        title={`Open options for ${itemName}`}
        onClick={actionsMenu.toggleMenu}
      />
      {actionsMenu.open &&
        menuPosition &&
        createPortal(
          <div
            ref={actionsMenu.panelRef}
            role="menu"
            style={menuPosition}
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
                  ref={actionsMenu.submenuTriggerRef}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={actionsMenu.submenuOpen}
                  className={menuItemClassName}
                  onClick={actionsMenu.toggleSubmenu}
                >
                  Move to...
                  <span className="ml-auto text-xs text-neutral-400">{'>'}</span>
                </button>
                {actionsMenu.submenuOpen &&
                  submenuPosition &&
                  createPortal(
                    <div
                      ref={actionsMenu.submenuPanelRef}
                      role="menu"
                      style={submenuPosition}
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
