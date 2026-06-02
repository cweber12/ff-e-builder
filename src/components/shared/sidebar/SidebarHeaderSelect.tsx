import { ChevronDown } from 'lucide-react';
import { DropdownMenu, MenuItem } from '../../primitives';

type SidebarHeaderSelectOption = {
  label: string;
  active?: boolean;
  onSelect: () => void;
};

type SidebarHeaderSelectProps = {
  valueLabel: string;
  ariaLabel: string;
  options: SidebarHeaderSelectOption[];
};

export function SidebarHeaderSelect({ valueLabel, ariaLabel, options }: SidebarHeaderSelectProps) {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  return (
    <DropdownMenu
      wrapperClassName="w-full"
      panelClassName="z-[280] min-w-44"
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
          <span>{valueLabel}</span>
          <ChevronDown className="project-sidebar-header-control-icon" aria-hidden="true" />
        </button>
      )}
    >
      {({ closeMenu }) =>
        options.map((option) => (
          <MenuItem
            key={option.label}
            type="button"
            className={option.active ? 'font-bold' : undefined}
            onClick={() => {
              closeMenu();
              option.onSelect();
            }}
          >
            {option.label}
          </MenuItem>
        ))
      }
    </DropdownMenu>
  );
}
