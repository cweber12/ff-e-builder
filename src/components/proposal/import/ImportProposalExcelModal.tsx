import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { api, type CreateProposalItemInput } from '../../../lib/api';
import {
  PROPOSAL_IMPORT_EMPTY_MAP,
  autoMapProposalColumns,
  imageToFile,
  isSummaryProposalRow,
  parseProposalSpreadsheet,
  parseProposalSpreadsheetWithLabels,
  rowHasImportableContent,
  type ParsedProposalSpreadsheet,
  type ProposalImportColumnMap,
  type ProposalImportField,
  type ProposalImportImage,
  type ProposalParsedRow,
} from '../../../lib/import';
import type { ProposalCategoryWithItems } from '../../../types';
import { Button, Modal } from '../../primitives';
import { ImportProgressBar } from '../../shared/ImportProgressBar';
import { describeImportError, type ImportProgress } from '../../shared/importUtils';

type Props = {
  open: boolean;
  projectId: string;
  categories: ProposalCategoryWithItems[];
  onClose: () => void;
  onSuccess: () => void;
};

type Step = 'upload' | 'headers-missing' | 'map';

type ImportResult = {
  imported: number;
  skipped: number;
  imagesImported: number;
  warnings: string[];
};

const SKIP = '__skip__';

const FIELD_LABELS: Record<ProposalImportField, string> = {
  category: 'Category',
  rendering: 'Rendering Image',
  productTag: 'Product Tag',
  plan: 'Plan Image / Text',
  drawings: 'Drawings',
  location: 'Location',
  description: 'Product Description',
  sizeLabel: 'Size',
  swatches: 'Swatches',
  cbm: 'CBM',
  quantity: 'Quantity',
  quantityUnit: 'Quantity Unit',
  unitCost: 'Unit Cost',
};

const FIELD_ORDER: ProposalImportField[] = [
  'category',
  'rendering',
  'productTag',
  'plan',
  'drawings',
  'location',
  'description',
  'sizeLabel',
  'swatches',
  'cbm',
  'quantity',
  'quantityUnit',
  'unitCost',
];

const IMAGE_FIELDS = new Set<ProposalImportField>(['rendering', 'plan', 'swatches']);

export function ImportProposalExcelModal({
  open,
  projectId,
  categories,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedProposalSpreadsheet | null>(null);
  const [mapping, setMapping] = useState<ProposalImportColumnMap>(PROPOSAL_IMPORT_EMPTY_MAP);
  const [defaultCategoryName, setDefaultCategoryName] = useState(categories[0]?.name ?? 'Imported');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    processed: 0,
    total: 0,
    startedAt: null,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [userLabels, setUserLabels] = useState('');
  const [missingLabels, setMissingLabels] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsed(null);
    setMapping(PROPOSAL_IMPORT_EMPTY_MAP);
    setDefaultCategoryName(categories[0]?.name ?? 'Imported');
    setError('');
    setImporting(false);
    setResult(null);
    setProgress({ processed: 0, total: 0, startedAt: null });
    setPendingFile(null);
    setUserLabels('');
    setMissingLabels([]);
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
      const data = await parseProposalSpreadsheet(file);
      if (data.columns.length === 0) {
        setPendingFile(file);
        setStep('headers-missing');
        return;
      }
      setParsed(data);
      setMapping(autoMapProposalColumns(data.columns));
      setStep('map');
    } catch {
      setError('Failed to parse the file. Make sure it is a valid .xlsx, .xls, or .csv file.');
    }
  }, []);

  const handleUserLabels = useCallback(async () => {
    if (!pendingFile) return;
    const labels = userLabels
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (labels.length === 0) {
      setError('Enter at least one column header name.');
      return;
    }
    setError('');
    try {
      const { parsed: data, missingLabels: missing } = await parseProposalSpreadsheetWithLabels(
        pendingFile,
        labels,
      );
      if (data.columns.length === 0) {
        setError('None of the column names were found. Check the spelling and try again.');
        return;
      }
      setParsed(data);
      setMapping(autoMapProposalColumns(data.columns));
      setMissingLabels(missing);
      setStep('map');
    } catch {
      setError('Failed to scan the file. Please try again.');
    }
  }, [pendingFile, userLabels]);

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

  const setField = (field: ProposalImportField, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value === SKIP ? null : value }));
  };

  const importPlan = useMemo(() => {
    if (!parsed) return { importableRows: [], skippedRows: [] as ProposalParsedRow[] };
    const importableRows: ProposalParsedRow[] = [];
    const skippedRows: ProposalParsedRow[] = [];

    for (const row of parsed.rows) {
      if (row.skippedReason || isSummaryProposalRow(row)) {
        skippedRows.push({ ...row, skippedReason: row.skippedReason ?? 'Summary row' });
        continue;
      }
      if (rowHasImportableContent(row, mapping)) {
        importableRows.push(row);
      } else {
        skippedRows.push({ ...row, skippedReason: 'No mapped data' });
      }
    }

    return { importableRows, skippedRows };
  }, [mapping, parsed]);

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setError('');

    const warnings = [...parsed.warnings];
    let imported = 0;
    let skipped = 0;
    let imagesImported = 0;
    let processedSteps = 0;

    const markProgress = () => {
      processedSteps += 1;
      setProgress((current) => ({
        ...current,
        processed: processedSteps,
      }));
    };

    try {
      setProgress({
        processed: 0,
        total: parsed.projectImages.length + importPlan.importableRows.length,
        startedAt: Date.now(),
      });

      const categoryNameToId = new Map(
        categories.map((category) => [category.name.toLowerCase(), category.id]),
      );

      // Imported project images should become the project's current image set.
      if (parsed.projectImages.length > 0) {
        const existingProjectImages = await api.images.list({
          entityType: 'project',
          entityId: projectId,
        });

        setProgress((current) => ({
          ...current,
          total: current.total + existingProjectImages.length,
        }));

        for (const image of existingProjectImages) {
          try {
            await api.images.delete(image.id);
          } catch (err) {
            warnings.push(
              `Existing project image could not be removed: ${describeImportError(err)}`,
            );
          }
          markProgress();
        }
      }

      for (const [index, image] of parsed.projectImages.entries()) {
        try {
          await api.images.upload({
            entityType: 'project',
            entityId: projectId,
            file: imageToFile(image, `project-import-${index + 1}.png`),
            altText: `Imported project image ${index + 1}`,
          });
          imagesImported += 1;
        } catch (err) {
          warnings.push(`Project image ${index + 1} was skipped: ${describeImportError(err)}`);
        }
        markProgress();
      }

      for (const row of importPlan.importableRows) {
        const categoryName =
          getValue(row, mapping.category) || row.categoryName || defaultCategoryName || 'Imported';
        let categoryId = categoryNameToId.get(categoryName.toLowerCase());
        if (!categoryId) {
          const category = await api.proposal.createCategory(projectId, {
            name: categoryName,
            sortOrder: categoryNameToId.size,
          });
          categoryNameToId.set(category.name.toLowerCase(), category.id);
          categoryId = category.id;
        }

        try {
          const item = await api.proposal.createItem(categoryId, buildProposalItem(row, mapping));
          const rowImageUploads = [
            ...selectedImages(row, mapping.rendering, 1).map((image, index) => ({
              image,
              entityType: 'proposal_item' as const,
              altText: `Imported rendering ${index + 1}`,
            })),
            ...selectedImages(row, mapping.plan, 1).map((image, index) => ({
              image,
              entityType: 'proposal_plan' as const,
              altText: `Imported plan image ${index + 1}`,
            })),
          ];

          // Swatch images become material library entries
          const swatchImages = selectedImages(row, mapping.swatches, 4);
          for (const [index, swatchImage] of swatchImages.entries()) {
            try {
              const material = await api.materials.createAndAssignToProposalItem(item.id, {
                name: '',
                materialId: '',
              });
              await api.images.upload({
                entityType: 'material',
                entityId: material.id,
                file: imageToFile(swatchImage, `swatch-${material.id}-${index + 1}.png`),
                altText: `Imported swatch ${index + 1}`,
              });
              imagesImported += 1;
            } catch (err) {
              warnings.push(
                `Swatch image ${index + 1} on row ${row.rowNumber} was skipped: ${describeImportError(err)}`,
              );
            }
          }

          for (const upload of rowImageUploads) {
            try {
              await api.images.upload({
                entityType: upload.entityType,
                entityId: item.id,
                file: imageToFile(upload.image, `${upload.entityType}-${item.id}.png`),
                altText: upload.altText,
              });
              imagesImported += 1;
            } catch (err) {
              warnings.push(
                `An image on spreadsheet row ${row.rowNumber} was skipped: ${describeImportError(err)}`,
              );
            }
          }

          const urlUploads = [
            ...imageUrlsFromValue(getValue(row, mapping.rendering))
              .slice(0, selectedImages(row, mapping.rendering, 1).length > 0 ? 0 : 1)
              .map((url, index) => ({
                url,
                entityType: 'proposal_item' as const,
                altText: `Imported rendering URL ${index + 1}`,
              })),
            ...imageUrlsFromValue(getValue(row, mapping.plan))
              .slice(0, selectedImages(row, mapping.plan, 1).length > 0 ? 0 : 1)
              .map((url, index) => ({
                url,
                entityType: 'proposal_plan' as const,
                altText: `Imported plan URL ${index + 1}`,
              })),
          ];

          for (const upload of urlUploads) {
            try {
              const file = await imageUrlToFile(upload.url);
              await api.images.upload({
                entityType: upload.entityType,
                entityId: item.id,
                file,
                altText: upload.altText,
              });
              imagesImported += 1;
            } catch (err) {
              warnings.push(
                `An image URL on spreadsheet row ${row.rowNumber} was skipped: ${describeImportError(err)}`,
              );
            }
          }

          // Swatch URLs become material library entries
          const swatchUrls = imageUrlsFromValue(getValue(row, mapping.swatches)).slice(
            0,
            Math.max(0, 4 - swatchImages.length),
          );
          for (const [index, url] of swatchUrls.entries()) {
            try {
              const file = await imageUrlToFile(url);
              const material = await api.materials.createAndAssignToProposalItem(item.id, {
                name: '',
                materialId: '',
              });
              await api.images.upload({
                entityType: 'material',
                entityId: material.id,
                file,
                altText: `Imported swatch URL ${index + 1}`,
              });
              imagesImported += 1;
            } catch (err) {
              warnings.push(
                `Swatch URL ${index + 1} on row ${row.rowNumber} was skipped: ${describeImportError(err)}`,
              );
            }
          }

          imported += 1;
        } catch {
          skipped += 1;
        }

        markProgress();
      }

      skipped += importPlan.skippedRows.length;
      setResult({ imported, skipped, imagesImported, warnings });
      onSuccess();
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const previewRows = importPlan.importableRows.slice(0, 6);
  const headers = parsed?.columns ?? [];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import proposal from Excel"
      className="max-w-5xl"
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-brand-50 p-4">
            <p className="text-sm font-semibold text-brand-700">
              Import complete: {result.imported} row{result.imported !== 1 ? 's' : ''} imported,{' '}
              {result.imagesImported} image{result.imagesImported !== 1 ? 's' : ''} imported
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
            </p>
          </div>
          {result.warnings.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {result.warnings.slice(0, 8).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : step === 'upload' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Upload a Proposal spreadsheet. You will review detected tables, map spreadsheet columns,
            and preview the rows before importing.
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
          {error && (
            <p role="alert" className="text-sm text-danger-600">
              {error}
            </p>
          )}
        </div>
      ) : step === 'headers-missing' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Column headers were not detected automatically. Enter the column header names exactly as
            they appear in your spreadsheet.
          </p>
          <textarea
            value={userLabels}
            onChange={(e) => setUserLabels(e.target.value)}
            placeholder={'Category\nProduct Description\nQuantity\nUnit Cost'}
            rows={5}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500">One column name per line, or separated by commas.</p>
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
                setError('');
              }}
            >
              Back
            </Button>
            <Button type="button" onClick={() => void handleUserLabels()}>
              Find Columns
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 rounded-lg border border-gray-200 bg-surface-muted p-3 text-sm text-gray-700 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Sheet</p>
              <p className="font-medium">{parsed?.sheetName || parsed?.filename}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Categories</p>
              <p className="font-medium">{parsed?.sections.length ?? 0} detected</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Rows</p>
              <p className="font-medium">{importPlan.importableRows.length} ready</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Project Images</p>
              <p className="font-medium">{parsed?.projectImages.length ?? 0} detected</p>
            </div>
          </div>

          {parsed?.sections.length ? (
            <div className="flex flex-wrap gap-2">
              {parsed.sections.map((section) => (
                <span
                  key={section.index}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                >
                  {section.categoryName}: {section.rowCount} rows
                </span>
              ))}
            </div>
          ) : null}

          <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-muted text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Proposal Field</th>
                  <th className="px-3 py-2 text-left">Spreadsheet Column</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {FIELD_ORDER.map((field) => (
                  <tr key={field}>
                    <td className="px-3 py-2 font-medium text-gray-700">{FIELD_LABELS[field]}</td>
                    <td className="px-3 py-2">
                      <select
                        value={mapping[field] ?? SKIP}
                        onChange={(event) => setField(field, event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value={SKIP}>Skip</option>
                        {headers.map((column) => (
                          <option key={column.key} value={column.key}>
                            {column.label}
                            {IMAGE_FIELDS.has(field) && hasImagesForColumn(parsed, column.key)
                              ? ' + images'
                              : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!mapping.category && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-surface-muted p-3">
              <label className="shrink-0 text-sm font-medium text-gray-700">
                Default category:
              </label>
              <input
                value={defaultCategoryName}
                onChange={(event) => setDefaultCategoryName(event.target.value)}
                className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger-600">
              {error}
            </p>
          )}

          {missingLabels.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Column{missingLabels.length !== 1 ? 's' : ''} not found in file:{' '}
              {missingLabels.join(', ')}
            </p>
          )}

          {previewRows.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                Preview ({previewRows.length} of {importPlan.importableRows.length} rows)
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 text-xs">
                <table className="min-w-full">
                  <thead className="bg-surface-muted text-gray-600">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Category</th>
                      {FIELD_ORDER.filter((field) => mapping[field]).map((field) => (
                        <th key={field} className="px-2 py-1.5 text-left">
                          {FIELD_LABELS[field]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.map((row) => (
                      <tr key={row.id}>
                        <td className="max-w-32 truncate px-2 py-1.5 text-gray-700">
                          {getValue(row, mapping.category) || row.categoryName}
                        </td>
                        {FIELD_ORDER.filter((field) => mapping[field]).map((field) => (
                          <td key={field} className="max-w-36 truncate px-2 py-1.5 text-gray-700">
                            {IMAGE_FIELDS.has(field)
                              ? imagePreviewLabel(row, mapping[field], field)
                              : getValue(row, mapping[field])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importPlan.skippedRows.length > 0 && (
            <p className="text-xs text-gray-500">
              {importPlan.skippedRows.length} row{importPlan.skippedRows.length !== 1 ? 's' : ''}{' '}
              will be skipped for summaries, totals, or no mapped data.
            </p>
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
                disabled={importing || importPlan.importableRows.length === 0}
              >
                {importing ? 'Importing...' : `Import ${importPlan.importableRows.length} rows`}
              </Button>
            </div>
          </div>
          {importing && progress.total > 0 && (
            <ImportProgressBar progress={progress} nowMs={nowMs} label="Proposal import progress" />
          )}
        </div>
      )}
    </Modal>
  );
}

function buildProposalItem(
  row: ProposalParsedRow,
  mapping: ProposalImportColumnMap,
): CreateProposalItemInput {
  return {
    productTag: getValue(row, mapping.productTag),
    plan: getValue(row, mapping.plan),
    drawings: getValue(row, mapping.drawings),
    location: getValue(row, mapping.location),
    description: getValue(row, mapping.description),
    sizeLabel: getValue(row, mapping.sizeLabel),
    cbm: parseNumber(getValue(row, mapping.cbm)),
    quantity: parseNumber(getValue(row, mapping.quantity), 1),
    quantityUnit: getValue(row, mapping.quantityUnit) || 'unit',
    unitCostCents: parseMoney(getValue(row, mapping.unitCost)),
  };
}

function getValue(row: ProposalParsedRow, columnKey: string | null): string {
  if (!columnKey) return '';
  return (row.values[columnKey] ?? '').trim();
}

function selectedImages(
  row: ProposalParsedRow,
  columnKey: string | null,
  limit: number,
): ProposalImportImage[] {
  if (!columnKey) return [];
  return (row.imagesByColumn[columnKey] ?? []).slice(0, limit);
}

function hasImagesForColumn(parsed: ParsedProposalSpreadsheet | null, columnKey: string): boolean {
  return parsed?.rows.some((row) => (row.imagesByColumn[columnKey] ?? []).length > 0) ?? false;
}

function imagePreviewLabel(
  row: ProposalParsedRow,
  columnKey: string | null,
  field: ProposalImportField,
): string {
  const imageCount = selectedImages(row, columnKey, field === 'swatches' ? 4 : 1).length;
  const text = getValue(row, columnKey);
  if (imageCount > 0) return `${imageCount} image${imageCount !== 1 ? 's' : ''}`;
  return text;
}

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value.replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function imageUrlsFromValue(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(entry));
}

async function imageUrlToFile(url: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Image URL could not be fetched');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('URL is not an image');
  const extension = blob.type.split('/')[1] || 'png';
  return new File([blob], `imported-url-image.${extension}`, { type: blob.type });
}
