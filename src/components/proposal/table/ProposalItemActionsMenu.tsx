import { useState } from 'react';
import { GeneratedItemActionTrigger } from '../../shared/table/GeneratedItemActionControls';
import { cn } from '../../../lib/utils';
import { DeleteItemModal } from './DeleteItemModal';
import { DropdownMenu, MenuItem, MenuSeparator, MenuSub, MenuSubTrigger } from '../../primitives';

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
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="inline-flex">
      <DropdownMenu
        panelClassName="z-[100] min-w-48"
        renderTrigger={({ triggerRef, open, toggleMenu }) => (
          <GeneratedItemActionTrigger
            ref={triggerRef}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`Open options for ${itemName}`}
            title={`Open options for ${itemName}`}
            onClick={toggleMenu}
          />
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
            <MenuItem
              onClick={() => {
                closeMenu();
                onViewDetails();
              }}
            >
              View details
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              onClick={() => {
                closeMenu();
                onDuplicate();
              }}
            >
              Duplicate
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                onAddToFfe();
              }}
            >
              Add to FF&amp;E
            </MenuItem>
            {otherCategories.length > 0 && (
              <>
                <MenuSubTrigger
                  ref={submenuTriggerRef}
                  aria-expanded={submenuOpen}
                  onClick={toggleSubmenu}
                >
                  Move to...
                  <span className="ml-auto text-xs text-neutral-400">{'>'}</span>
                </MenuSubTrigger>
                <MenuSub
                  open={submenuOpen}
                  panelRef={submenuPanelRef}
                  position={getSubmenuPosition({ align: 'top', edge: 'left', offsetX: -4 })}
                  className="z-[100] min-w-40"
                >
                  {otherCategories.map((cat) => (
                    <MenuItem
                      key={cat.id}
                      onClick={() => {
                        closeMenu();
                        onMove(cat.id);
                      }}
                    >
                      {cat.name}
                    </MenuItem>
                  ))}
                </MenuSub>
              </>
            )}
            <MenuSeparator />
            <MenuItem
              className={cn('text-danger-600 hover:bg-red-50 hover:text-danger-700')}
              onClick={() => {
                closeMenu();
                setDeleteOpen(true);
              }}
            >
              Delete item
            </MenuItem>
          </>
        )}
      </DropdownMenu>
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
