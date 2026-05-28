import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useCreateFinish, useUploadImage } from '../../hooks';
import {
  autoMapFinishColumns,
  parseFinishSpreadsheet,
  type FinishImportColumnMap,
  type FinishImportImage,
  type FinishParsedRow,
  type ImportProgress,
  type ParsedFinishSpreadsheet,
} from '../../lib/import';
import type { MaterialCategory } from '../../types';
import { Button, Modal } from '../primitives';
import { ImportProgressBar } from '../shared/ImportProgressBar';

type Props = {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
};

type Step = 'upload' | 'confirm' | 'import';

type ImportResult = {
  created: number;
  importedImages: number;
  warnings: string[];
};

const VALID_FILE_EXTENSIONS = new Set(['xlsx', 'xls', 'csv']);
const DEFAULT_SWATCH_HEX = '#D9D4C8';
const HEADER_ERROR_MESSAGE =
  'No recognizable header row was detected. Make sure the spreadsheet has at least 3 column labels.';

const FIELD_LABELS: Record<keyof FinishImportColumnMap, string> = {
  name: 'Name',
  code: 'Code',
  category: 'Category',
  subCategory: 'Sub-category',
  manufacturer: 'Manufacturer',
  sourceUrl: 'Source URL',
  swatchHex: 'Swatch hex',
  description: 'Description',
  image: 'Image',
};

const MATERIAL_CATEGORY_BY_NORMALIZED_LABEL: Record<string, MaterialCategory> = {
  wood: 'wood',
  metal: 'metal',
  stone: 'stone',
  glass: 'glass',
  fabric: 'fabric',
  'solid color': 'solid_color',
  solid_color: 'solid_color',
  solidcolor: 'solid_color',
};

export function ImportFinishesExcelModal({ open, projectId, onClose, onSuccess }: Props) {
  const createFinish = useCreateFinish(projectId);
  const uploadImage = useUploadImage();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedFinishSpreadsheet | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    processed: 0,
    total: 0,
    startedAt: null,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());

  const reset = useCallback(() => {
    setStep('upload');
    setParsed(null);
    setError('');
    setImporting(false);
    setResult(null);
    setProgress({
      processed: 0,
      total: 0,
      startedAt: null,
    });
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

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
    setResult(null);

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!VALID_FILE_EXTENSIONS.has(extension)) {
      setParsed(null);
      setStep('upload');
      setError('Unsupported file type. Upload a .xlsx, .xls, or .csv file.');
      return;
    }

    try {
      const nextParsed = await parseFinishSpreadsheet(file);
      if (nextParsed.columns.length === 0) {
        setParsed(null);
        setStep('upload');
        setError(nextParsed.warnings[0] ?? HEADER_ERROR_MESSAGE);
        return;
      }
      setParsed(nextParsed);
      setStep('confirm');
    } catch {
      setParsed(null);
      setStep('upload');
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

  const recognizedColumns = useMemo(() => {
    if (!parsed) return [];
    const mapping = autoMapFinishColumns(parsed.columns);
    return (Object.keys(FIELD_LABELS) as Array<keyof FinishImportColumnMap>).flatMap((field) => {
      const key = mapping[field];
      if (!key) return [];
      const column = parsed.columns.find((candidate) => candidate.key === key);
      return [`${FIELD_LABELS[field]}: ${column?.label ?? key}`];
    });
  }, [parsed]);

  const runImport = useCallback(async () => {
    if (!parsed) return;

    setStep('import');
    setImporting(true);
    setError('');
    setResult(null);
    setProgress({
      processed: 0,
      total: parsed.rows.length,
      startedAt: Date.now(),
    });

    const warnings = [...parsed.warnings];
    let created = 0;
    let importedImages = 0;
    let processed = 0;

    try {
      const mapping = autoMapFinishColumns(parsed.columns);
      const nameColumnFallback = parsed.columns[0]?.key ?? null;
      const nameColumn = mapping.name ?? nameColumnFallback;

      for (const row of parsed.rows) {
        try {
          const rowInput = buildFinishCreateInput(row, { ...mapping, name: nameColumn }, warnings);
          if (!rowInput.name) {
            warnings.push(`Row ${row.rowNumber}: missing finish name, skipped.`);
          } else {
            const saved = await createFinish.mutateAsync(rowInput);
            created += 1;

            const image = pickRowImage(row, mapping.image);
            if (image) {
              try {
                await uploadImage.mutateAsync({
                  entityType: 'finish',
                  entityId: saved.id,
                  file: importImageToFile(image, `finish-row-${row.rowNumber}.png`),
                  altText: saved.name,
                });
                importedImages += 1;
              } catch {
                warnings.push(`Row ${row.rowNumber}: swatch image upload failed.`);
              }
            }
          }
        } catch {
          warnings.push(`Row ${row.rowNumber}: finish create failed.`);
        } finally {
          processed += 1;
          setProgress((current) => ({ ...current, processed }));
        }
      }

      setResult({ created, importedImages, warnings });
      if (created > 0) onSuccess();
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }, [createFinish, onSuccess, parsed, uploadImage]);

  const totalRows = parsed?.rows.length ?? 0;

  return (
    <Modal open={open} onClose={handleClose} title="Import from Excel" className="max-w-xl">
      {step === 'upload' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Upload an Excel (.xlsx, .xls) or CSV file to bulk-create finish library entries.
          </p>
          <div
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 border-y-2 border-dashed border-neutral-200 bg-canvas-shell px-6 py-10 text-center transition hover:border-brand-500 hover:bg-brand-50/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-10 w-10 text-neutral-400"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 5.75 5.75 0 0 1 .91 11.095H6.75Z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-neutral-700">
                Drop file here or click to browse
              </p>
              <p className="mt-1 text-xs text-neutral-500">.xlsx, .xls, .csv</p>
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
      )}

      {step === 'confirm' && parsed && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 border border-neutral-200 bg-canvas-shell p-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">File</p>
              <p className="truncate font-medium">{parsed.filename}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Rows</p>
              <p className="font-medium">{totalRows}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Columns</p>
              <p className="font-medium">{parsed.columns.length}</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Detected columns ({parsed.columns.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {parsed.columns.map((column) => (
                <span
                  key={column.key}
                  className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                >
                  {column.label}
                </span>
              ))}
            </div>
          </div>

          {recognizedColumns.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Recognized fields
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {recognizedColumns.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {parsed.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
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
              <Button type="button" onClick={() => void runImport()} disabled={totalRows === 0}>
                Import {totalRows} row{totalRows !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'import' && (
        <div className="flex flex-col gap-4">
          {result ? (
            <>
              <div className="rounded-lg bg-brand-50 p-4">
                <p className="text-sm font-semibold text-brand-700">
                  Import complete: {result.created} finish{result.created !== 1 ? 'es' : ''}{' '}
                  created, {result.importedImages} image{result.importedImages !== 1 ? 's' : ''}{' '}
                  imported.
                </p>
              </div>
              {result.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  <p className="mb-1 font-medium">Warnings</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {result.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="button" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-700">Importing finishes…</p>
              <ImportProgressBar
                progress={progress}
                nowMs={nowMs}
                label="Finishes import progress"
              />
              {error && (
                <p role="alert" className="text-sm text-danger-600">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function buildFinishCreateInput(
  row: FinishParsedRow,
  mapping: FinishImportColumnMap,
  warnings: string[],
) {
  const name = getMappedValue(row, mapping.name);
  const code = getMappedValue(row, mapping.code);
  const categoryValue = getMappedValue(row, mapping.category);
  const category = parseMaterialCategory(categoryValue);
  if (!category && categoryValue.trim()) {
    warnings.push(
      `Row ${row.rowNumber}: unknown category "${categoryValue.trim()}", imported without category.`,
    );
  }

  const swatchHexRaw = getMappedValue(row, mapping.swatchHex);
  const swatchHex = normalizeHexColor(swatchHexRaw);
  if (!swatchHex && swatchHexRaw.trim()) {
    warnings.push(
      `Row ${row.rowNumber}: invalid swatch hex "${swatchHexRaw.trim()}", using default color.`,
    );
  }

  return {
    name,
    code,
    category,
    subCategory: getMappedValue(row, mapping.subCategory),
    description: getMappedValue(row, mapping.description),
    manufacturer: getMappedValue(row, mapping.manufacturer),
    sourceUrl: getMappedValue(row, mapping.sourceUrl),
    swatchHex: swatchHex ?? DEFAULT_SWATCH_HEX,
  };
}

function getMappedValue(row: FinishParsedRow, columnKey: string | null): string {
  if (!columnKey) return '';
  return (row.values[columnKey] ?? '').trim();
}

function normalizeMaterialCategoryLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function parseMaterialCategory(value: string): MaterialCategory | null {
  if (!value.trim()) return null;
  return MATERIAL_CATEGORY_BY_NORMALIZED_LABEL[normalizeMaterialCategoryLabel(value)] ?? null;
}

function normalizeHexColor(value: string): string | null {
  if (!value.trim()) return null;
  const normalized = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : null;
}

function pickRowImage(
  row: FinishParsedRow,
  imageColumnKey: string | null,
): FinishImportImage | null {
  if (imageColumnKey) {
    const imageFromColumn = row.imagesByColumn[imageColumnKey]?.[0];
    if (imageFromColumn) return imageFromColumn;
  }
  return row.images.image[0] ?? null;
}

function importImageToFile(image: FinishImportImage, fallbackName: string): File {
  const bytes = new Uint8Array(image.bytes);
  const blob = new Blob([bytes], { type: image.contentType });
  return new File([blob], image.filename || fallbackName, { type: image.contentType });
}
