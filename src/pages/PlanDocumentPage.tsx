import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, FileText, Star } from 'lucide-react';
import { Button } from '../components/primitives';
import { usePlanDocument, useUpdatePlanDocument } from '../hooks';
import type { MeasuredPlan, Project } from '../types';

type PlanDocumentPageProps = {
  project: Project;
  documentId: string;
};

export function PlanDocumentPage({ project, documentId }: PlanDocumentPageProps) {
  const { data, isLoading } = usePlanDocument(project.id, documentId);
  const updateDocument = useUpdatePlanDocument(project.id, documentId);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    if (data?.document.name) setNameDraft(data.document.name);
  }, [data?.document.name]);

  async function handleSaveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!data || name.length === 0 || name === data.document.name) return;
    await updateDocument.mutateAsync({ name });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl py-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-56 bg-neutral-200" />
          <div className="h-28 bg-neutral-100" />
          <div className="h-64 bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl py-4">
        <Link
          to={`/projects/${project.id}/plans`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to plan documents
        </Link>
        <div className="mt-6 border-y border-neutral-200 bg-canvas-chrome px-6 py-12 text-center">
          <h2 className="font-display text-lg font-semibold text-neutral-950">
            Plan document not found
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            This document may have been deleted or moved.
          </p>
        </div>
      </div>
    );
  }

  const { document, sheets } = data;
  const nameChanged = nameDraft.trim().length > 0 && nameDraft.trim() !== document.name;

  return (
    <div className="mx-auto max-w-6xl py-4">
      <Link
        to={`/projects/${project.id}/plans`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to plan documents
      </Link>

      <header className="mt-5 border-y border-neutral-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
              <FileText className="h-4 w-4" aria-hidden="true" />
              {document.sourceType === 'pdf' ? 'PDF document' : 'Image document'}
            </div>
            <form onSubmit={(event) => void handleSaveName(event)} className="mt-2 flex gap-2">
              <label className="sr-only" htmlFor="plan-document-name">
                Document name
              </label>
              <input
                id="plan-document-name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                className="min-w-0 flex-1 border border-neutral-200 bg-white px-3 py-2 font-display text-2xl font-semibold text-neutral-950 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={!nameChanged || updateDocument.isPending}
                aria-label="Save document name"
                className="mt-1 shrink-0"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Save
              </Button>
            </form>
            <p className="mt-2 text-sm text-neutral-500">
              {document.sourceFilename} · Updated {formatDate(document.updatedAt)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center md:min-w-[21rem]">
            <SummaryStat value={document.sheetCount} label="Sheets" />
            <SummaryStat value={document.calibratedSheetCount} label="Calibrated" />
            <SummaryStat value={document.measurementCount} label="Measurements" />
          </div>
        </div>
      </header>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-neutral-950">Sheets</h3>
          <span className="num-muted text-xs">{sheets.length} total</span>
        </div>

        {sheets.length > 0 ? (
          <div className="overflow-hidden border-y border-neutral-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[88px_minmax(0,1.4fr)_minmax(0,1fr)_140px_150px] border-b border-neutral-200 bg-canvas-shell px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500 md:grid">
              <span>Sheet</span>
              <span>Title</span>
              <span>Source</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-neutral-200">
              {sheets.map((sheet) => (
                <SheetRow
                  key={sheet.id}
                  projectId={project.id}
                  sheet={sheet}
                  isCover={document.coverMeasuredPlanId === sheet.id}
                  settingCover={
                    updateDocument.isPending &&
                    updateDocument.variables?.coverMeasuredPlanId === sheet.id
                  }
                  onSetCover={() =>
                    void updateDocument.mutateAsync({ coverMeasuredPlanId: sheet.id })
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="canvas-hatch border-y border-dashed border-neutral-300 px-6 py-12 text-center">
            <h3 className="font-display text-base font-semibold text-neutral-950">
              No sheets in this document
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              Upload another document to add measurable sheets.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function SheetRow({
  projectId,
  sheet,
  isCover,
  settingCover,
  onSetCover,
}: {
  projectId: string;
  sheet: MeasuredPlan;
  isCover: boolean;
  settingCover: boolean;
  onSetCover: () => void;
}) {
  const openHref = `/projects/${projectId}/plans/${sheet.id}`;
  const calibrated = sheet.calibrationStatus === 'calibrated';
  const sourceLabel =
    sheet.sourceType === 'pdf-page' && sheet.pdfPageNumber
      ? `Page ${sheet.pdfPageNumber}`
      : formatBytes(sheet.imageByteSize);

  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[88px_minmax(0,1.4fr)_minmax(0,1fr)_140px_150px] md:items-center">
      <div>
        <p className="num text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
          {sheet.sheetReference || sheet.pageLabel || `Sheet ${sheet.sheetIndex}`}
        </p>
        <p className="num-muted mt-0.5 text-[11px] md:hidden">Sheet {sheet.sheetIndex}</p>
      </div>

      <div className="min-w-0">
        <Link
          to={openHref}
          className="block truncate font-display text-base font-semibold text-neutral-950 hover:text-brand-700"
        >
          {sheet.name}
        </Link>
        <p className="num-muted mt-1 text-xs">{sheet.measurementCount} measurements</p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-700">{sourceLabel}</p>
        <p className="num-muted mt-1 text-xs">{sheet.imageFilename}</p>
      </div>

      <div>
        <span
          className={['status-chip', calibrated ? 'status-chip--ok' : 'status-chip--warn'].join(
            ' ',
          )}
        >
          {calibrated ? 'Calibrated' : 'Needs calibration'}
        </span>
      </div>

      <div className="flex flex-wrap justify-start gap-2 md:justify-end">
        {isCover ? (
          <span className="status-chip status-chip--neutral">
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            Cover
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={settingCover}
            onClick={onSetCover}
            aria-label={`Set ${sheet.name} as cover sheet`}
          >
            <Star className="h-4 w-4" aria-hidden="true" />
            {settingCover ? 'Saving' : 'Set cover'}
          </Button>
        )}
        <Button asChild variant="secondary" size="sm">
          <Link to={openHref}>Open sheet</Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-neutral-200 bg-canvas-shell px-3 py-2">
      <p className="num text-lg font-semibold text-neutral-950">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
