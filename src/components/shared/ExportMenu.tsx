import { type ReactNode } from 'react';
import { DropdownMenu, MenuItem, MenuSub, MenuSubTrigger } from '../primitives';

type ExportMenuProps = {
  label?: ReactNode;
  onCsv?: () => void;
  onExcel?: () => void;
  onPdf: () => void;
  pdfOptions?: Array<{
    label: string;
    onSelect: () => void;
  }>;
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
};

export function ExportMenu({
  label = 'Export',
  onCsv,
  onExcel,
  onPdf,
  pdfOptions,
  className = '',
  buttonClassName,
  size = 'sm',
  disabled = false,
}: ExportMenuProps) {
  const baseBtn = size === 'sm' ? 'btn-action' : 'btn-action';

  const triggerButtonClass = buttonClassName ?? baseBtn;

  return (
    <DropdownMenu
      wrapperClassName={`relative inline-flex ${className}`}
      panelClassName="z-[120] min-w-40"
      positionOptions={{ align: 'bottom', edge: 'left', offsetY: 4 }}
      renderTrigger={({ triggerRef, open, toggleMenu }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggleMenu}
          className={`${triggerButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={disabled}
        >
          {label}
          <svg viewBox="0 0 14 14" className="toolbar-icon" aria-hidden="true">
            <path d="M3.5 5.5 7 9l3.5-3.5" />
          </svg>
        </button>
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
          {onCsv && (
            <MenuItem
              className="gap-2 px-3 py-2"
              onClick={() => {
                closeMenu();
                onCsv();
              }}
            >
              <CsvIcon />
              Export CSV
            </MenuItem>
          )}
          {onExcel && (
            <MenuItem
              className="gap-2 px-3 py-2"
              onClick={() => {
                closeMenu();
                onExcel();
              }}
            >
              <ExcelIcon />
              Export Excel
            </MenuItem>
          )}
          {pdfOptions?.length ? (
            <>
              <MenuSubTrigger
                ref={submenuTriggerRef}
                aria-expanded={submenuOpen}
                className="gap-2 px-3 py-2"
                onClick={toggleSubmenu}
              >
                <PdfIcon />
                Export PDF
                <span className="ml-auto text-xs text-neutral-400">{'>'}</span>
              </MenuSubTrigger>
              <MenuSub
                open={submenuOpen}
                panelRef={submenuPanelRef}
                position={getSubmenuPosition({ align: 'top', edge: 'left', offsetX: 0 })}
                className="z-[121] min-w-36 translate-x-[calc(100%+0.25rem)]"
              >
                {pdfOptions.map((option) => (
                  <MenuItem
                    key={option.label}
                    className="px-3 py-2"
                    onClick={() => {
                      closeMenu();
                      option.onSelect();
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuSub>
            </>
          ) : (
            <MenuItem
              className="gap-2 px-3 py-2"
              onClick={() => {
                closeMenu();
                onPdf();
              }}
            >
              <PdfIcon />
              Export PDF
            </MenuItem>
          )}
        </>
      )}
    </DropdownMenu>
  );
}

function CsvIcon() {
  return (
    <svg viewBox="0 0 14 14" className="toolbar-icon text-neutral-500" aria-hidden="true">
      <path d="M3 1.5h5l3 3v8H3z" />
      <path d="M8 1.5v3h3" />
      <path d="M4.5 9.5h5" />
    </svg>
  );
}

function ExcelIcon() {
  return (
    <svg viewBox="0 0 14 14" className="toolbar-icon text-success-700" aria-hidden="true">
      <path d="M3 1.5h5l3 3v8H3z" />
      <path d="M8 1.5v3h3" />
      <path d="M4.5 9.5 7 12l2.5-2.5" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 14 14" className="toolbar-icon text-danger-600" aria-hidden="true">
      <path d="M3 1.5h5l3 3v8H3z" />
      <path d="M8 1.5v3h3" />
      <path d="M4.5 9.5h3M4.5 11.5h2" />
    </svg>
  );
}
