import { ChevronDown } from 'lucide-react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { DropdownMenu } from '../../primitives';

type SidebarHeaderMenuRenderProps = {
  closeMenu: () => void;
  submenuOpen: boolean;
  openSubmenu: () => void;
  closeSubmenu: () => void;
  toggleSubmenu: () => void;
  submenuTriggerRef: RefObject<HTMLButtonElement>;
  submenuPanelRef: RefObject<HTMLDivElement>;
  getSubmenuPosition: (options?: {
    align?: 'top' | 'bottom';
    anchorEdge?: 'left' | 'right';
    panelEdge?: 'left' | 'right';
    edge?: 'left' | 'right';
    offsetY?: number;
    offsetX?: number;
  }) => CSSProperties | null;
};

type SidebarHeaderMenuProps = {
  label?: string;
  ariaLabel?: string;
  children: (props: SidebarHeaderMenuRenderProps) => ReactNode;
};

export function SidebarHeaderMenu({
  label = 'Options',
  ariaLabel = 'Sidebar options',
  children,
}: SidebarHeaderMenuProps) {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  return (
    <DropdownMenu
      wrapperClassName="w-full"
      panelClassName="z-[280] min-w-52"
      positionOptions={
        isDesktop
          ? { align: 'top', anchorEdge: 'left', panelEdge: 'right', offsetY: 0, offsetX: 0 }
          : { align: 'bottom', edge: 'left', offsetY: 6 }
      }
      renderTrigger={({ triggerRef, open, toggleMenu }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          className="project-sidebar-header-control justify-start"
          onClick={toggleMenu}
        >
          <span>{label}</span>
          <ChevronDown className="project-sidebar-header-control-icon" aria-hidden="true" />
        </button>
      )}
    >
      {children}
    </DropdownMenu>
  );
}
