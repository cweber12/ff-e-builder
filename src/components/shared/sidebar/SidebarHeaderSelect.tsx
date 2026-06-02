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
  return (
    <DropdownMenu
      wrapperClassName="w-full"
      panelClassName="z-[280] min-w-44"
      positionOptions={{ align: 'bottom', edge: 'left', offsetY: 4 }}
      renderTrigger={({ triggerRef, open, toggleMenu }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          className="project-section-select"
          onClick={toggleMenu}
        >
          <span className="project-section-select-label">{valueLabel}</span>
          <ChevronDown className="project-section-select-icon" aria-hidden="true" />
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
