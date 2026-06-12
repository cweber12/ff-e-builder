import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, FileText, Star, Trash2 } from 'lucide-react';
import { Button } from '../components/primitives';
import {
  useDeleteMeasuredPlan,
  usePlanDocument,
  useUpdateMeasuredPlan,
  useUpdatePlanDocument,
} from '../hooks';
import type { MeasuredPlan, Project } from '../types';

type PlanDocumentPageProps = {
  project: Project;
  documentId: string;
};

export function PlanDocumentPage({ project, documentId }: PlanDocumentPageProps) {
  const navigate = useNavigate();
  const { data, isLoading } = usePlanDocument(project.id, documentId);
  const updateDocument = useUpdatePlanDocument(project.id, documentId);
  const updateSheet = useUpdateMeasuredPlan(project.id);
  const deleteSheet = useDeleteMeasuredPlan(project.id);
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

  async function handleDeleteSheet(sheet: MeasuredPlan, sheetCount: number) {
    const measurementWarning =
      sheet.measurementCount > 0
        ? ` ${sheet.measurementCount} saved measurement${sheet.measurementCount === 1 ? '' : 's'} will be removed.`
        : '';
    const lastSheetWarning =
      sheetCount <= 1
        ? ' This is the last sheet, so the entire plan document will be deleted.'
        : '';
    const confirmed = window.confirm(
      `Delete "${sheet.name}"?${measurementWarning}${lastSheetWarning}`,
    );

    if (!confirmed) return;
    await deleteSheet.mutateAsync(sheet);

    if (sheetCount <= 1) {
      navigate(`/projects/${project.id}/plans`);
    }
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
                  updatingSheet={
                    updateSheet.isPending && updateSheet.variables?.planId === sheet.id
                  }
                  deletingSheet={deleteSheet.isPending && deleteSheet.variables?.id === sheet.id}
                  onSetCover={() =>
                    void updateDocument.mutateAsync({ coverMeasuredPlanId: sheet.id })
                  }
                  onSaveSheet={(input) =>
                    void updateSheet.mutateAsync({
                      planId: sheet.id,
                      input,
                    })
                  }
                  onDelete={() => void handleDeleteSheet(sheet, sheets.length)}
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
  updatingSheet,
  deletingSheet,
  onSetCover,
  onSaveSheet,
  onDelete,
}: {
  projectId: string;
  sheet: MeasuredPlan;
  isCover: boolean;
  settingCover: boolean;
  updatingSheet: boolean;
  deletingSheet: boolean;
  onSetCover: () => void;
  onSaveSheet: (input: { name?: string; sheetReference?: string }) => void;
  onDelete: () => void;
}) {
  const [sheetReferenceDraft, setSheetReferenceDraft] = useState(sheet.sheetReference);
  const [nameDraft, setNameDraft] = useState(sheet.name);
  const openHref = `/projects/${projectId}/plans/${sheet.id}`;
  const calibrated = sheet.calibrationStatus === 'calibrated';
  const sourceLabel =
    sheet.sourceType === 'pdf-page' && sheet.pdfPageNumber
      ? `Page ${sheet.pdfPageNumber}`
      : formatBytes(sheet.imageByteSize);
  const sheetReferenceChanged = sheetReferenceDraft.trim() !== sheet.sheetReference;
  const nameChanged = nameDraft.trim().length > 0 && nameDraft.trim() !== sheet.name;
  const canSaveSheet = sheetReferenceChanged || nameChanged;

  useEffect(() => {
    setSheetReferenceDraft(sheet.sheetReference);
    setNameDraft(sheet.name);
  }, [sheet.name, sheet.sheetReference]);

  function handleSaveSheet() {
    if (!canSaveSheet) return;
    onSaveSheet({
      ...(nameChanged ? { name: nameDraft.trim() } : {}),
      ...(sheetReferenceChanged ? { sheetReference: sheetReferenceDraft.trim() } : {}),
    });
  }

  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[88px_minmax(0,1.4fr)_minmax(0,1fr)_140px_150px] md:items-center">
      <div>
        <label className="sr-only" htmlFor={`sheet-reference-${sheet.id}`}>
          Sheet reference for {sheet.name}
        </label>
        <input
          id={`sheet-reference-${sheet.id}`}
          value={sheetReferenceDraft}
          onChange={(event) => setSheetReferenceDraft(event.target.value)}
          placeholder={sheet.pageLabel || `Sheet ${sheet.sheetIndex}`}
          className="num w-full min-w-0 border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700 outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
        />
        <p className="num-muted mt-0.5 text-[11px] md:hidden">Sheet {sheet.sheetIndex}</p>
      </div>

      <div className="min-w-0">
        <label className="sr-only" htmlFor={`sheet-name-${sheet.id}`}>
          Sheet title for {sheet.name}
        </label>
        <input
          id={`sheet-name-${sheet.id}`}
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          className="w-full min-w-0 border border-neutral-200 bg-white px-2.5 py-1.5 font-display text-base font-semibold text-neutral-950 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
        />
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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canSaveSheet || updatingSheet}
          onClick={handleSaveSheet}
          aria-label={`Save sheet metadata for ${sheet.name}`}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {updatingSheet ? 'Saving' : 'Save'}
        </Button>
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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={deletingSheet}
          onClick={onDelete}
          aria-label={`Delete ${sheet.name}`}
          className="hover:border-danger-500 hover:text-danger-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {deletingSheet ? 'Deleting' : 'Delete'}
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
