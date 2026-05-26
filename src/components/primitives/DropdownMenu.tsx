import { createPortal } from 'react-dom';
import { useEffect, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useActionsMenu } from '../../hooks';
import { MenuPanel } from './MenuPanel';

type PositionOptions = {
  align?: 'top' | 'bottom';
  edge?: 'left' | 'right';
  offsetY?: number;
  offsetX?: number;
};

type TriggerRenderProps = {
  triggerRef: RefObject<HTMLButtonElement>;
  open: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
};

type ContentRenderProps = {
  open: boolean;
  closeMenu: () => void;
  submenuOpen: boolean;
  openSubmenu: () => void;
  closeSubmenu: () => void;
  toggleSubmenu: () => void;
  submenuTriggerRef: RefObject<HTMLButtonElement>;
  submenuPanelRef: RefObject<HTMLDivElement>;
  getSubmenuPosition: (options?: PositionOptions) => CSSProperties | null;
};

type DropdownMenuProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  wrapperClassName?: string;
  panelClassName?: string;
  positionOptions?: PositionOptions;
  renderTrigger: (props: TriggerRenderProps) => ReactNode;
  children: (props: ContentRenderProps) => ReactNode;
};

export function DropdownMenu({
  open,
  onOpenChange,
  wrapperClassName = 'inline-flex',
  panelClassName,
  positionOptions,
  renderTrigger,
  children,
}: DropdownMenuProps) {
  const {
    open: isOpen,
    submenuOpen,
    triggerRef,
    panelRef,
    submenuTriggerRef,
    submenuPanelRef,
    openMenu,
    closeMenu,
    toggleMenu,
    openSubmenu,
    closeSubmenu,
    toggleSubmenu,
    getPortalPosition,
  } = useActionsMenu();

  useEffect(() => {
    if (open === undefined) return;
    if (open && !isOpen) {
      openMenu();
      return;
    }
    if (!open && isOpen) {
      closeMenu();
    }
  }, [open, isOpen, openMenu, closeMenu]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const menuPosition = getPortalPosition(triggerRef, positionOptions);

  return (
    <div className={wrapperClassName}>
      {renderTrigger({
        triggerRef,
        open: isOpen,
        toggleMenu,
        closeMenu,
      })}
      {isOpen &&
        menuPosition &&
        createPortal(
          <MenuPanel ref={panelRef} position={menuPosition} className={panelClassName}>
            {children({
              open: isOpen,
              closeMenu,
              submenuOpen,
              openSubmenu,
              closeSubmenu,
              toggleSubmenu,
              submenuTriggerRef,
              submenuPanelRef,
              getSubmenuPosition: (options?: PositionOptions) =>
                getPortalPosition(submenuTriggerRef, options),
            })}
          </MenuPanel>,
          document.body,
        )}
    </div>
  );
}
