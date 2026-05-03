import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { api } from '../lib/api';
import { parseExcelFile, type ParsedSpreadsheet } from '../lib/importUtils';
import type { TakeoffCategoryWithItems } from '../types';
import { Button, Modal } from './primitives';

type Props = {
  open: boolean;
  projectId: string;
  categories: TakeoffCategoryWithItems[];
  onClose: () => void;
  onSuccess: () => void;
};

const aliases = {
  category: ['category', 'table category', 'section'],
  productTag: ['product tag', 'tag', 'product', 'item tag'],
  plan: ['plan'],
  drawings: ['drawings', 'drawing', 'drawings / location'],
  location: ['location', 'area'],
  description: ['product description', 'description'],
  sizeLabel: ['size', 'dimensions'],
  swatches: ['swatch', 'swatches', 'material'],
  cbm: ['cbm'],
  quantity: ['quantity', 'qty'],
  quantityUnit: ['unit', 'uom', 'quantity unit'],
  unitCost: ['unit cost', 'cost', 'price'],
} as const;

export function ImportTakeoffExcelModal({
  open,
  projectId,
  categories,
  onClose,
  onSuccess,
}: Props) {
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setParsed(null);
    setError('');
    setImporting(false);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback(async (file: File) => {
    setError('');
    try {
      const data = await parseExcelFile(file);
      if (!data.headers.length) {
        setError('The file appears empty or has no headers.');
        return;
      }
      setParsed(data);
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
      const categoryMap = new Map(
        categories.map((category) => [category.name.toLowerCase(), category.id]),
      );
      let imported = 0;
      let skipped = 0;

      for (const row of parsed.rows) {
        const categoryName =
          read(row, parsed.headers, aliases.category) || categories[0]?.name || 'Millwork';
        const productTag = read(row, parsed.headers, aliases.productTag);
        const description = read(row, parsed.headers, aliases.description);

        if (!productTag && !description) {
          skipped += 1;
          continue;
        }

        let categoryId = categoryMap.get(categoryName.toLowerCase());
        if (!categoryId) {
          const category = await api.takeoff.createCategory(projectId, {
            name: categoryName,
            sortOrder: categoryMap.size,
          });
          categoryMap.set(category.name.toLowerCase(), category.id);
          categoryId = category.id;
        }

        try {
          await api.takeoff.createItem(categoryId, {
            productTag,
            plan: read(row, parsed.headers, aliases.plan),
            drawings: read(row, parsed.headers, aliases.drawings),
            location: read(row, parsed.headers, aliases.location),
            description,
            sizeLabel: read(row, parsed.headers, aliases.sizeLabel),
            swatches: splitList(read(row, parsed.headers, aliases.swatches)),
            cbm: parseNumber(read(row, parsed.headers, aliases.cbm)),
            quantity: parseNumber(read(row, parsed.headers, aliases.quantity), 1),
            quantityUnit: read(row, parsed.headers, aliases.quantityUnit) || 'unit',
            unitCostCents: parseMoney(read(row, parsed.headers, aliases.unitCost)),
          });
          imported += 1;
        } catch {
          skipped += 1;
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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import take-off from Excel"
      className="max-w-2xl"
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-brand-50 p-4">
            <p className="text-sm font-semibold text-brand-700">
              Import complete: {result.imported} row{result.imported !== 1 ? 's' : ''} imported
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Upload an Excel or CSV take-off sheet. Columns are matched by common labels such as
            Category, Product Tag, Plan, Drawings, Location, Size, Swatch, CBM, Quantity, Unit, and
            Unit Cost.
          </p>
          <div
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-surface-muted px-6 py-10 text-center transition hover:border-brand-500 hover:bg-brand-50/50"
          >
            <p className="text-sm font-medium text-gray-700">Drop file here or click to browse</p>
            <p className="text-xs text-gray-500">.xlsx, .xls, .csv</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={handleInputChange}
          />
          {parsed && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">
              Ready to import {parsed.rows.length} spreadsheet row
              {parsed.rows.length !== 1 ? 's' : ''}.
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!parsed || importing}
              onClick={() => void handleImport()}
            >
              {importing ? 'Importing...' : 'Import rows'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function read(row: Record<string, string>, headers: string[], names: readonly string[]) {
  const normalizedNames = names.map(normalizeHeader);
  const header = headers.find((candidate) => normalizedNames.includes(normalizeHeader(candidate)));
  return header ? (row[header] ?? '').trim() : '';
}

function splitList(value: string) {
  return value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value.replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}
