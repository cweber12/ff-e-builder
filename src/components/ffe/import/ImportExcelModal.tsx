import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { api } from '../../../lib/api';
import {
  autoMapColumns,
  canonicalColumnLabel,
  parseFFESpreadsheet,
  transformRows,
  type ColumnMap,
  type ParsedFFESpreadsheet,
} from '../../../lib/import';
import type { RoomWithItems } from '../../../types';
import { Button } from '../../primitives/Button';
import { Modal } from '../../primitives/Modal';
import { ImportProgressBar } from '../../shared/ImportProgressBar';
import { type ImportProgress } from '../../shared/importUtils';

type Props = {
  open: boolean;
  projectId: string;
  rooms: RoomWithItems[];
  onClose: () => void;
  onSuccess: () => void;
};

type Step = 'upload' | 'confirm';

export function ImportExcelModal({ open, projectId, rooms, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedFFESpreadsheet | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    processed: 0,
    total: 0,
    startedAt: null,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsed(null);
    setError('');
    setImporting(false);
    setResult(null);
    setProgress({ processed: 0, total: 0, startedAt: null });
  };

  useEffect(() => {
    if (!importing) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [importing]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback(async (file: File) => {
    setError('');
    try {
      const data = await parseFFESpreadsheet(file);
      if (data.sections.length === 0) {
        setError(
          'No table was detected in this file. Make sure the spreadsheet has a header row with at least 3 column labels.',
        );
        return;
      }
      setParsed(data);
      setStep('confirm');
    } catch {
      setError('Failed to parse the file. Make sure it is a valid .xlsx, .xls, or .csv file.');
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setError('');

    try {
      const autoMap = autoMapColumns(parsed.columns);
      const firstColKey = parsed.columns[0]?.key ?? null;
      const mapping: ColumnMap = {
        itemName: autoMap.itemName ?? firstColKey,
        category: autoMap.category ?? null,
        itemIdTag: autoMap.itemIdTag ?? null,
        dimensions: autoMap.dimensions ?? null,
        qty: autoMap.qty ?? null,
        unitCostDollars: autoMap.unitCostDollars ?? null,
        status: autoMap.status ?? null,
        leadTime: autoMap.leadTime ?? null,
        notes: autoMap.notes ?? null,
        room: null,
        materials: autoMap.materials ?? null,
      };

      const usedKeys = new Set(Object.values(mapping).filter(Boolean) as string[]);
      const allRows = parsed.sections.flatMap((s) => s.rows);
      const unmappedCols = parsed.columns.filter((col) => {
        if (usedKeys.has(col.key)) return false;
        return allRows.some((row) => (row[col.key] ?? '').trim().length > 0);
      });
      const customDataKeyMap = new Map<string, string>();

      if (unmappedCols.length > 0) {
        const existingDefs = await api.columnDefs.list(projectId, 'ffe');
        const existingByLabel = new Map(existingDefs.map((d) => [d.label.toLowerCase(), d]));

        for (const col of unmappedCols) {
          const defLabel = canonicalColumnLabel(col.label);
          const existing = existingByLabel.get(defLabel.toLowerCase());
          if (existing) {
            customDataKeyMap.set(col.key, existing.id);
          } else {
            const created = await api.columnDefs.create(projectId, {
              label: defLabel,
              sortOrder: existingDefs.length + customDataKeyMap.size,
              tableType: 'ffe',
            });
            existingByLabel.set(defLabel.toLowerCase(), created);
            customDataKeyMap.set(col.key, created.id);
          }
        }
      }

      const roomNameToId = new Map<string, string>(rooms.map((r) => [r.name.toLowerCase(), r.id]));
      const createdRooms = new Map<string, string>();
      const totalItems = parsed.sections.reduce((acc, s) => acc + s.rows.length, 0);

      let imported = 0;
      let skipped = 0;
      let processed = 0;

      setProgress({ processed: 0, total: totalItems, startedAt: Date.now() });

      for (const section of parsed.sections) {
        const name = section.title;
        let roomId = roomNameToId.get(name.toLowerCase()) ?? createdRooms.get(name.toLowerCase());

        if (!roomId) {
          const newRoom = await api.rooms.create(projectId, {
            name,
            sortOrder: rooms.length + createdRooms.size,
          });
          createdRooms.set(name.toLowerCase(), newRoom.id);
          roomId = newRoom.id;
        }

        const items = transformRows(section.rows, mapping, parsed.columns, customDataKeyMap);

        for (const item of items) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { roomName: _rn, materialsRaw, ...itemInput } = item;

          try {
            const created = await api.items.create(roomId, itemInput);

            if (mapping.materials && materialsRaw) {
              const materialNames = materialsRaw
                .split(/[,;|]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              for (const matName of materialNames) {
                try {
                  await api.materials.createAndAssignToItem(created.id, {
                    name: matName,
                    materialId: '',
                  });
                } catch {
                  // Non-fatal: material import errors don't block item import
                }
              }
            }

            imported += 1;
          } catch {
            skipped += 1;
          }

          processed += 1;
          setProgress((current) => ({ ...current, processed }));
        }
      }

      setResult({ imported, skipped });
      onSuccess();
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const totalRows = parsed?.sections.reduce((acc, s) => acc + s.rows.length, 0) ?? 0;

  return (
    <Modal open={open} onClose={handleClose} title="Import from Excel" className="max-w-xl">
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-brand-50 p-4">
            <p className="text-sm font-semibold text-brand-700">
              Import complete: {result.imported} item{result.imported !== 1 ? 's' : ''} imported
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : step === 'upload' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Upload an Excel (.xlsx, .xls) or CSV file. Column headers and data will be imported
            automatically.
          </p>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-surface-muted px-6 py-10 text-center transition hover:border-brand-500 hover:bg-brand-50/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-10 w-10 text-gray-400"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 5.75 5.75 0 0 1 .91 11.095H6.75Z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-700">Drop file here or click to browse</p>
              <p className="mt-1 text-xs text-gray-500">.xlsx, .xls, .csv</p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={handleInputChange}
          />
          {error && (
            <p role="alert" className="text-sm text-danger-600">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-gray-200 bg-surface-muted p-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Sheet</p>
              <p className="truncate font-medium">{parsed?.sheetName || parsed?.filename}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Rooms</p>
              <p className="font-medium">{parsed?.sections.length ?? 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Rows</p>
              <p className="font-medium">{totalRows}</p>
            </div>
          </div>

          {parsed && parsed.sections.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.sections.map((section, i) => (
                <span
                  key={i}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                >
                  {section.title}: {section.rows.length} row{section.rows.length !== 1 ? 's' : ''}
                </span>
              ))}
            </div>
          )}

          {parsed && parsed.columns.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                Columns detected ({parsed.columns.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {parsed.columns.map((col) => (
                  <span
                    key={col.key}
                    className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                  >
                    {col.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {parsed && parsed.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {parsed.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep('upload');
                setParsed(null);
                setError('');
              }}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing || totalRows === 0}
              >
                {importing ? 'Importing…' : `Import ${totalRows} row${totalRows !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
          {importing && progress.total > 0 && (
            <ImportProgressBar progress={progress} nowMs={nowMs} label="FF&E import progress" />
          )}
        </div>
      )}
    </Modal>
  );
}
