import { type ReactNode } from 'react';
import { ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { DropdownMenu, MenuItem, MenuSub, MenuSubTrigger, Button } from '../primitives';
import type { ButtonVariant } from '../primitives';

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
  buttonVariant?: ButtonVariant;
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
  buttonVariant = 'toolbar',
  size = 'sm',
  disabled = false,
}: ExportMenuProps) {
  const triggerSize = size === 'md' ? 'md' : 'sm';

  return (
    <DropdownMenu
      wrapperClassName={`relative inline-flex ${className}`}
      panelClassName="z-[120] min-w-40"
      positionOptions={{ align: 'bottom', edge: 'left', offsetY: 4 }}
      renderTrigger={({ triggerRef, open, toggleMenu }) => (
        <Button
          ref={triggerRef}
          type="button"
          variant={buttonVariant}
          size={triggerSize}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggleMenu}
          className={buttonClassName}
          disabled={disabled}
        >
          {label}
          <ChevronDown className="sidebar-button-trailing-icon toolbar-icon" aria-hidden="true" />
        </Button>
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
  return <FileText className="toolbar-icon text-neutral-500" aria-hidden="true" />;
}

function ExcelIcon() {
  return <FileSpreadsheet className="toolbar-icon text-success-700" aria-hidden="true" />;
}

function PdfIcon() {
  return <FileText className="toolbar-icon text-danger-600" aria-hidden="true" />;
}
