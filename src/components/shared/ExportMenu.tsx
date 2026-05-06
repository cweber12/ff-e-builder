import { useEffect, useRef, useState } from 'react';

type ExportMenuProps = {
  label?: string;
  onCsv?: () => void;
  onExcel?: () => void;
  onPdf: () => void;
  pdfOptions?: Array<{
    label: string;
    onSelect: () => void;
  }>;
  className?: string;
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
  size = 'sm',
  disabled = false,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const baseBtn =
    size === 'sm'
      ? 'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500'
      : 'rounded-md border border-brand-500 bg-white px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

  const optionBtn =
    'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${baseBtn} disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={disabled}
      >
        {label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="ml-1 inline-block h-3 w-3 shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1 min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
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
                <span className="ml-auto text-xs text-gray-400">{'>'}</span>
              </button>
              {pdfOpen && (
                <div
                  role="menu"
                  className="absolute left-full top-0 z-50 ml-1 min-w-36 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
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
        </div>
      )}
    </div>
  );
}

function CsvIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-4 w-4 text-gray-500"
      aria-hidden="true"
    >
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h4.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12A1.5 1.5 0 0 1 13 5.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 12.5v-9Z" />
    </svg>
  );
}

function ExcelIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-4 w-4 text-success-500"
      aria-hidden="true"
    >
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h4.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12A1.5 1.5 0 0 1 13 5.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 12.5v-9Zm4.75 5.5a.75.75 0 0 0-1.5 0v1.25H5a.75.75 0 0 0 0 1.5h1.25V13a.75.75 0 0 0 1.5 0v-1.25H9a.75.75 0 0 0 0-1.5H7.75V9Z" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-4 w-4 text-danger-500"
      aria-hidden="true"
    >
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h4.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12A1.5 1.5 0 0 1 13 5.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 12.5v-9Zm4 4a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0V11h.5a1.5 1.5 0 0 0 0-3H7Z" />
    </svg>
  );
}
