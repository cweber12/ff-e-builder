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
  autoMapProposalColumns,
  canonicalColumnLabel,
  imageToFile,
  isSummaryProposalRow,
  parseProposalSpreadsheet,
  rowHasImportableContent,
  type ParsedProposalSpreadsheet,
  type ProposalImportColumn,
  type ProposalImportColumnMap,
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

type Step = 'upload' | 'confirm';

type ImportResult = {
  imported: number;
  skipped: number;
  imagesImported: number;
  warnings: string[];
};

export function ImportProposalExcelModal({
  open,
  projectId,
  categories,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedProposalSpreadsheet | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
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
      const data = await parseProposalSpreadsheet(file);
      if (data.columns.length === 0) {
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

  const mapping = useMemo<ProposalImportColumnMap>(
    () => (parsed ? autoMapProposalColumns(parsed.columns) : ({} as ProposalImportColumnMap)),
    [parsed],
  );

  const importableRows = useMemo(() => {
    if (!parsed) return [] as ProposalParsedRow[];
    return parsed.rows.filter((row) => !row.skippedReason && rowHasImportableContent(row));
  }, [parsed]);

  const skippedCount = useMemo(() => {
    if (!parsed) return 0;
    return parsed.rows.filter((row) => row.skippedReason || isSummaryProposalRow(row)).length;
  }, [parsed]);

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
      setProgress((current) => ({ ...current, processed: processedSteps }));
    };

    try {
      setProgress({
        processed: 0,
        total: parsed.projectImages.length + importableRows.length,
        startedAt: Date.now(),
      });

      const categoryNameToId = new Map(
        categories.map((category) => [category.name.toLowerCase(), category.id]),
      );

      const usedKeys = new Set(Object.values(mapping).filter((v): v is string => v !== null));
      const unmappedCols = parsed.columns.filter((col) => {
        if (usedKeys.has(col.key)) return false;
        return importableRows.some((row) => (row.values[col.key] ?? '').trim().length > 0);
      });
      const customDataKeyMap = new Map<string, string>();

      if (unmappedCols.length > 0) {
        const existingDefs = await api.columnDefs.list(projectId, 'proposal');
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
              tableType: 'proposal',
            });
            existingByLabel.set(defLabel.toLowerCase(), created);
            customDataKeyMap.set(col.key, created.id);
          }
        }
      }

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

      for (const row of importableRows) {
        const categoryName = getValue(row, mapping.category) || row.categoryName || 'Imported';
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
          const item = await api.proposal.createItem(
            categoryId,
            buildProposalItem(row, mapping, parsed.columns, customDataKeyMap),
          );

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

      skipped += skippedCount;
      setResult({ imported, skipped, imagesImported, warnings });
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
      title="Import proposal from Excel"
      className="max-w-xl"
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
            Upload a Proposal spreadsheet (.xlsx, .xls, .csv). Categories, columns, and data will be
            imported automatically.
          </p>
          <div
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
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
          <div className="grid grid-cols-4 gap-3 rounded-lg border border-gray-200 bg-surface-muted p-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Sheet</p>
              <p className="truncate font-medium">{parsed?.sheetName || parsed?.filename}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Categories</p>
              <p className="font-medium">{parsed?.sections.length ?? 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Rows</p>
              <p className="font-medium">{importableRows.length} ready</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Images</p>
              <p className="font-medium">{parsed?.projectImages.length ?? 0}</p>
            </div>
          </div>

          {parsed && parsed.sections.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.sections.map((section) => (
                <span
                  key={section.index}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                >
                  {section.categoryName}: {section.rowCount} row{section.rowCount !== 1 ? 's' : ''}
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

          {skippedCount > 0 && (
            <p className="text-xs text-gray-500">
              {skippedCount} row{skippedCount !== 1 ? 's' : ''} will be skipped (summaries or
              totals).
            </p>
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
                disabled={importing || importableRows.length === 0}
              >
                {importing
                  ? 'Importing…'
                  : `Import ${importableRows.length} row${importableRows.length !== 1 ? 's' : ''}`}
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
  allColumns: ProposalImportColumn[],
  customDataKeyMap?: Map<string, string>,
): CreateProposalItemInput {
  const usedKeys = new Set(Object.values(mapping).filter((v): v is string => v !== null));
  const customData: Record<string, string> = {};
  for (const col of allColumns) {
    if (!usedKeys.has(col.key)) {
      const val = (row.values[col.key] ?? '').trim();
      if (val) {
        const key = customDataKeyMap?.get(col.key) ?? col.label;
        customData[key] = val;
      }
    }
  }

  return {
    productTag: getValue(row, mapping.productTag),
    plan: getValue(row, mapping.plan),
    drawings: getValue(row, mapping.drawings),
    location: getValue(row, mapping.location),
    description: getValue(row, mapping.description),
    notes: getValue(row, mapping.notes),
    sizeLabel: getValue(row, mapping.sizeLabel),
    cbm: parseNumber(getValue(row, mapping.cbm)),
    quantity: parseNumber(getValue(row, mapping.quantity), 1),
    quantityUnit: getValue(row, mapping.quantityUnit) || 'unit',
    unitCostCents: parseMoney(getValue(row, mapping.unitCost)),
    ...(Object.keys(customData).length > 0 && { customData }),
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
