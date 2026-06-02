import { MenuItem } from '../../primitives';
import { SidebarHeaderMenu } from './SidebarHeaderMenu';

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
    <SidebarHeaderMenu label={valueLabel} ariaLabel={ariaLabel}>
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
    </SidebarHeaderMenu>
  );
}
