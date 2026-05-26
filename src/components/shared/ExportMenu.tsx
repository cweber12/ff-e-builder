import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  const [open, setOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setPdfOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const baseBtn = size === 'sm' ? 'btn-action' : 'btn-action';

  const optionBtn =
    'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-neutral-700 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

  const triggerButtonClass = buttonClassName ?? baseBtn;

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${triggerButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={disabled}
      >
        {label}
        <svg viewBox="0 0 14 14" className="toolbar-icon" aria-hidden="true">
          <path d="M3.5 5.5 7 9l3.5-3.5" />
        </svg>
      </button>

      {open &&
        triggerRect &&
        createPortal(
          <div
            role="menu"
            style={{
              position: 'fixed',
              top: triggerRect.bottom + 4,
              left: triggerRect.left,
            }}
            className="z-[120] min-w-40 rounded-md border border-neutral-200 bg-white p-1 shadow-lg"
          >
            {onCsv && (
              <button
                type="button"
                role="menuitem"
                className={optionBtn}
                onClick={() => {
                  setOpen(false);
                  onCsv();
                }}
              >
                <CsvIcon />
                Export CSV
              </button>
            )}
            {onExcel && (
              <button
                type="button"
                role="menuitem"
                className={optionBtn}
                onClick={() => {
                  setOpen(false);
                  onExcel();
                }}
              >
                <ExcelIcon />
                Export Excel
              </button>
            )}
            {pdfOptions?.length ? (
              <div className="relative">
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={pdfOpen}
                  className={optionBtn}
                  onClick={() => setPdfOpen((current) => !current)}
                >
                  <PdfIcon />
                  Export PDF
                  <span className="ml-auto text-xs text-neutral-400">{'>'}</span>
                </button>
                {pdfOpen && (
                  <div
                    role="menu"
                    className="absolute left-full top-0 z-[121] ml-1 min-w-36 rounded-md border border-neutral-200 bg-white p-1 shadow-lg"
                  >
                    {pdfOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        role="menuitem"
                        className={optionBtn}
                        onClick={() => {
                          setPdfOpen(false);
                          setOpen(false);
                          option.onSelect();
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={optionBtn}
                onClick={() => {
                  setOpen(false);
                  onPdf();
                }}
              >
                <PdfIcon />
                Export PDF
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
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
