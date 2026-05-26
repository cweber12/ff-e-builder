import { useEffect, useState } from 'react';
import { Modal, Button } from '../../primitives';
import { exportProposalPdf, exportProposalExcel, exportProposalCsv } from '../../../lib/export';
import type {
  Project,
  ProposalCategoryWithItems,
  UserProfile,
  CustomColumnDef,
} from '../../../types';
import type { RevisionExportData } from '../../../lib/export/proposal/proposalDocument';

type ExportFormat = 'pdf' | 'excel' | 'csv';
type PdfMode = 'continuous' | 'separated';

interface ProposalExportModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  categoriesWithItems: ProposalCategoryWithItems[];
  userProfile?: UserProfile | null;
  customColumnDefs: CustomColumnDef[];
  revisionData: RevisionExportData;
  visibleOrder: string[];
}

export function ProposalExportModal({
  open,
  onClose,
  project,
  categoriesWithItems,
  userProfile,
  customColumnDefs,
  revisionData,
  visibleOrder,
}: ProposalExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [pdfMode, setPdfMode] = useState<PdfMode>('continuous');
  const [includeRevisions, setIncludeRevisions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const hasOpenRevision = revisionData.revisions.some((r) => r.closedAt === null);

  useEffect(() => {
    if (!open) return;
    setFormat('pdf');
    setPdfMode('continuous');
    setIncludeRevisions(hasOpenRevision);
    setSelectedIds(new Set(categoriesWithItems.map((c) => c.id)));
    setIsExporting(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCategory(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(categoriesWithItems.map((c) => c.id)));
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  async function handleExport() {
    const filtered = categoriesWithItems.filter((c) => selectedIds.has(c.id));
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        await exportProposalPdf(
          project,
          filtered,
          userProfile,
          { mode: pdfMode },
          customColumnDefs,
          visibleOrder,
        );
      } else if (format === 'excel') {
        await exportProposalExcel(
          project,
          filtered,
          userProfile,
          customColumnDefs,
          includeRevisions ? revisionData : undefined,
          visibleOrder,
        );
      } else {
        exportProposalCsv(project, filtered, customColumnDefs, visibleOrder);
      }
      onClose();
    } finally {
      setIsExporting(false);
    }
  }

  const canExport = selectedIds.size > 0 && !isExporting;

  return (
    <Modal open={open} onClose={onClose} title="Export Proposal" className="max-w-md">
      <div className="flex flex-col gap-5">
        {/* Format */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Format
          </legend>
          <div
            role="radiogroup"
            aria-label="Export format"
            className="inline-flex h-8 items-stretch border border-neutral-200 bg-canvas-chrome p-0.5"
          >
            {(['pdf', 'excel', 'csv'] as ExportFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                className={[
                  'inline-flex items-center px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition',
                  format === f
                    ? 'bg-brand-600 text-white'
                    : 'text-neutral-500 hover:text-brand-700',
                ].join(' ')}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </fieldset>

        {/* PDF mode */}
        {format === 'pdf' && (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Export Mode
            </legend>
            <div className="flex flex-col gap-2">
              {(['continuous', 'separated'] as PdfMode[]).map((mode) => (
                <label key={mode} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="radio"
                    name="pdfMode"
                    value={mode}
                    checked={pdfMode === mode}
                    onChange={() => setPdfMode(mode)}
                    className="accent-brand-600"
                  />
                  <span className="text-sm text-neutral-800 capitalize">{mode}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Include revisions (Excel only, only when a revision is open) */}
        {format === 'excel' && hasOpenRevision && (
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={includeRevisions}
              onChange={(e) => setIncludeRevisions(e.target.checked)}
              className="accent-brand-600"
            />
            <span className="text-sm text-neutral-800">Include revision data</span>
          </label>
        )}

        {/* Category filter */}
        <fieldset>
          <div className="mb-2 flex items-center justify-between">
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Categories
            </legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-brand-600 hover:underline"
              >
                Select all
              </button>
              <span className="text-neutral-300">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-brand-600 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded border border-neutral-200 bg-canvas-shell px-3 py-2">
            {categoriesWithItems.map((cat) => (
              <label key={cat.id} className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  aria-label={cat.name}
                  checked={selectedIds.has(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="accent-brand-600"
                />
                <span className="text-sm text-neutral-800">{cat.name}</span>
                <span className="ml-auto text-xs text-neutral-400">{cat.items.length}</span>
              </label>
            ))}
          </div>
          {selectedIds.size === 0 && (
            <p className="mt-1.5 text-xs text-danger-600">
              Select at least one category to export.
            </p>
          )}
        </fieldset>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleExport()}
            disabled={!canExport}
            title={selectedIds.size === 0 ? 'Select at least one category to export' : undefined}
          >
            {isExporting ? 'Exporting…' : 'Export'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
