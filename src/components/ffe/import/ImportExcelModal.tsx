import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { api } from '../../../lib/api';
import {
  autoMapColumns,
  parseExcelFile,
  transformRows,
  type ColumnMap,
  type ParsedSpreadsheet,
} from '../../../lib/importUtils';
import type { RoomWithItems } from '../../../types';
import { Button } from '../../primitives/Button';
import { Modal } from '../../primitives/Modal';

type Props = {
  open: boolean;
  projectId: string;
  rooms: RoomWithItems[];
  onClose: () => void;
  onSuccess: () => void;
};

type Step = 'upload' | 'map';

type ImportProgress = {
  processed: number;
  total: number;
  startedAt: number | null;
};

const FIELD_LABELS: Record<keyof ColumnMap, string> = {
  itemName: 'Item Name *',
  category: 'Category',
  vendor: 'Vendor',
  model: 'Model',
  itemIdTag: 'Item ID',
  dimensions: 'Dimensions',
  qty: 'Quantity',
  unitCostDollars: 'Unit Cost ($)',
  markupPct: 'Markup %',
  status: 'Status',
  leadTime: 'Lead Time',
  notes: 'Notes',
  room: 'Room',
  materials: 'Materials / Finishes',
};

const SKIP = '__skip__';

export function ImportExcelModal({ open, projectId, rooms, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMap>({
    itemName: null,
    category: null,
    vendor: null,
    model: null,
    itemIdTag: null,
    dimensions: null,
    qty: null,
    unitCostDollars: null,
    markupPct: null,
    status: null,
    leadTime: null,
    notes: null,
    room: null,
    materials: null,
  });
  const [defaultRoomId, setDefaultRoomId] = useState<string>(rooms[0]?.id ?? '');
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
    setMapping({
      itemName: null,
      category: null,
      vendor: null,
      model: null,
      itemIdTag: null,
      dimensions: null,
      qty: null,
      unitCostDollars: null,
      markupPct: null,
      status: null,
      leadTime: null,
      notes: null,
      room: null,
      materials: null,
    });
    setDefaultRoomId(rooms[0]?.id ?? '');
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
      const data = await parseExcelFile(file);
      if (data.headers.length === 0) {
        setError('The file appears empty or has no headers.');
        return;
      }
      const autoMap = autoMapColumns(data.headers);
      setParsed(data);
      setMapping({
        itemName: autoMap.itemName ?? null,
        category: autoMap.category ?? null,
        vendor: autoMap.vendor ?? null,
        model: autoMap.model ?? null,
        itemIdTag: autoMap.itemIdTag ?? null,
        dimensions: autoMap.dimensions ?? null,
        qty: autoMap.qty ?? null,
        unitCostDollars: autoMap.unitCostDollars ?? null,
        markupPct: autoMap.markupPct ?? null,
        status: autoMap.status ?? null,
        leadTime: autoMap.leadTime ?? null,
        notes: autoMap.notes ?? null,
        room: autoMap.room ?? null,
        materials: autoMap.materials ?? null,
      });
      setStep('map');
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

  const setField = (field: keyof ColumnMap, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value === SKIP ? null : value }));
  };

  const handleImport = async () => {
    if (!parsed) return;
    if (!mapping.itemName) {
      setError('Item Name column is required.');
      return;
    }
    setImporting(true);
    setError('');

    try {
      const items = transformRows(parsed.rows, mapping);

      const roomNameToId = new Map<string, string>(rooms.map((r) => [r.name.toLowerCase(), r.id]));
      const createdRooms = new Map<string, string>();

      let imported = 0;
      let skipped = 0;
      let processed = 0;

      setProgress({ processed: 0, total: items.length, startedAt: Date.now() });

      for (const item of items) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { roomName, materialsRaw: _materialsRaw, ...itemInput } = item;

        let roomId = defaultRoomId;

        if (roomName) {
          const existing = roomNameToId.get(roomName.toLowerCase());
          if (existing) {
            roomId = existing;
          } else {
            const cached = createdRooms.get(roomName.toLowerCase());
            if (cached) {
              roomId = cached;
            } else {
              const newRoom = await api.rooms.create(projectId, {
                name: roomName,
                sortOrder: rooms.length + createdRooms.size,
              });
              createdRooms.set(roomName.toLowerCase(), newRoom.id);
              roomId = newRoom.id;
            }
          }
        }

        if (!roomId) {
          skipped += 1;
          continue;
        }

        try {
          const created = await api.items.create(roomId, itemInput);
          // Import material entries from the materials column if mapped
          if (mapping.materials) {
            const materialNames = item.materialsRaw
              .split(/[,;|]+/)
              .map((s) => s.trim())
              .filter(Boolean);
            for (const matName of materialNames) {
              try {
                await api.materials.createAndAssignToItem(created.id, {
                  name: matName,
                  materialId: '',
                  finishClassification: 'material',
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
        setProgress((current) => ({
          ...current,
          processed,
        }));
      }

      setResult({ imported, skipped });
      onSuccess();
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const headers = parsed?.headers ?? [];
  const previewRows = parsed?.rows.slice(0, 3) ?? [];

  return (
    <Modal open={open} onClose={handleClose} title="Import from Excel" className="max-w-2xl">
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
            Upload an Excel (.xlsx, .xls) or CSV file to import items. You will map spreadsheet
            columns to FF&amp;E fields on the next step.
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
          <p className="text-sm text-gray-600">
            Map spreadsheet columns to FF&amp;E fields. Unmatched columns will be skipped.
          </p>

          {error && (
            <p role="alert" className="text-sm text-danger-600">
              {error}
            </p>
          )}

          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-muted text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">FF&amp;E Field</th>
                  <th className="px-3 py-2 text-left">Spreadsheet Column</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(Object.keys(FIELD_LABELS) as (keyof ColumnMap)[]).map((field) => (
                  <tr key={field} className={field === 'itemName' ? 'bg-brand-50/30' : ''}>
                    <td className="px-3 py-2 font-medium text-gray-700">{FIELD_LABELS[field]}</td>
                    <td className="px-3 py-2">
                      <select
                        value={mapping[field] ?? SKIP}
                        onChange={(e) => setField(field, e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value={SKIP}>â€” Skip â€”</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!mapping.room && rooms.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-surface-muted p-3">
              <label className="text-sm font-medium text-gray-700 shrink-0">Default room:</label>
              <select
                value={defaultRoomId}
                onChange={(e) => setDefaultRoomId(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {previewRows.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Preview (first {previewRows.length} rows)
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 text-xs">
                <table className="min-w-full">
                  <thead className="bg-surface-muted">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-600">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {headers.map((h) => (
                          <td key={h} className="px-2 py-1.5 text-gray-700 max-w-24 truncate">
                            {row[h] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <Button type="button" variant="ghost" onClick={() => setStep('upload')}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing || !mapping.itemName}
              >
                {importing ? 'Importingâ€¦' : `Import ${parsed?.rows.length ?? 0} rows`}
              </Button>
            </div>
          </div>
          {importing && progress.total > 0 && (
            <ImportProgressBar progress={progress} nowMs={nowMs} />
          )}
        </div>
      )}
    </Modal>
  );
}

function ImportProgressBar({ progress, nowMs }: { progress: ImportProgress; nowMs: number }) {
  const ratio = progress.total > 0 ? Math.min(1, progress.processed / progress.total) : 0;
  const percent = Math.round(ratio * 100);
  const elapsedMs = progress.startedAt ? Math.max(0, nowMs - progress.startedAt) : 0;
  const remainingSteps = Math.max(0, progress.total - progress.processed);
  const remainingMs =
    progress.processed > 0
      ? Math.round((elapsedMs / progress.processed) * remainingSteps)
      : undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-surface-muted p-3">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <span>
          Import progress: {progress.processed} of {progress.total}
        </span>
        <span>
          {percent}%
          {remainingMs !== undefined ? ` • ~${formatDuration(remainingMs)} remaining` : ''}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-label="FF&E import progress"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.processed}
        />
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}
