import { Link } from 'react-router-dom';
import { DropdownMenu, MenuItem } from '../primitives';
import { cn } from '../../lib/utils';

type ProjectOptionsMenuProps = {
  projectId?: string;
  projectName: string;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onImages: () => void;
  onDelete: () => void;
  align?: 'top' | 'bottom';
  buttonClassName?: string;
};

export function ProjectOptionsMenu({
  projectId,
  projectName,
  open,
  onToggle,
  onEdit,
  onImages,
  onDelete,
  align = 'top',
  buttonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-canvas-chrome text-neutral-500 shadow-sm transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
}: ProjectOptionsMenuProps) {
  const panelClassName = cn(
    'z-[80] min-w-44 text-sm',
    align === 'top' && '-translate-y-[calc(100%+0.25rem)]',
  );

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen !== open) onToggle();
      }}
      wrapperClassName="relative z-[90] inline-flex"
      panelClassName={panelClassName}
      positionOptions={{ align: align === 'top' ? 'top' : 'bottom', edge: 'left', offsetY: 0 }}
      renderTrigger={({ triggerRef, open: isOpen, toggleMenu }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Open options for ${projectName}`}
          aria-expanded={isOpen}
          onClick={toggleMenu}
          className={buttonClassName}
        >
          <MoreIcon />
        </button>
      )}
    >
      {({ closeMenu }) => (
        <>
          {projectId ? (
            <Link to={`/projects/${projectId}/plans`} className="menu-item" onClick={closeMenu}>
              Plans
            </Link>
          ) : null}
          <MenuItem
            onClick={() => {
              closeMenu();
              onEdit();
            }}
          >
            Update project
          </MenuItem>
          <MenuItem
            onClick={() => {
              closeMenu();
              onImages();
            }}
          >
            Project images
          </MenuItem>
          <MenuItem
            className="text-danger-600 hover:bg-red-50 hover:text-danger-700"
            onClick={() => {
              closeMenu();
              onDelete();
            }}
          >
            Delete project
          </MenuItem>
        </>
      )}
    </DropdownMenu>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
