import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/primitives';
import {
  useCreatePlanLengthLine,
  useDeletePlanLengthLine,
  useMeasuredPlans,
  usePlanCalibration,
  usePlanLengthLines,
  useSetPlanCalibration,
  useUpdatePlanLengthLine,
} from '../hooks';
import { api } from '../lib/api';
import type {
  LengthLine,
  MeasuredPlan,
  PlanCalibration,
  PlanMeasurementUnit,
  Project,
} from '../types';

type PlanCanvasPageProps = {
  project: Project;
  planId: string;
};

type LineDraft = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type ImagePoint = {
  x: number;
  y: number;
};

const TOOL_DEFINITIONS = [
  { id: 'calibrate', label: 'Calibrate', description: 'Set the plan scale from a reference line.' },
  { id: 'length', label: 'Length Line', description: 'Measure and save linear spans on the plan.' },
  {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'Capture an item footprint before attach + crop.',
  },
  { id: 'crop', label: 'Crop', description: 'Refine the derived plan image framing.' },
] as const;

const UNIT_OPTIONS: PlanMeasurementUnit[] = ['ft', 'in', 'm', 'cm', 'mm'];
const MILLIMETERS_PER_UNIT: Record<PlanMeasurementUnit, number> = {
  ft: 304.8,
  in: 25.4,
  mm: 1,
  cm: 10,
  m: 1000,
};

type ToolId = (typeof TOOL_DEFINITIONS)[number]['id'];

export function PlanCanvasPage({ project, planId }: PlanCanvasPageProps) {
  const { data: plans, isLoading } = useMeasuredPlans(project.id);
  const [activeTool, setActiveTool] = useState<ToolId>('calibrate');
  const [calibrationDraft, setCalibrationDraft] = useState<LineDraft | null>(null);
  const [calibrationLengthInput, setCalibrationLengthInput] = useState('1');
  const [calibrationUnit, setCalibrationUnit] = useState<PlanMeasurementUnit>('ft');
  const [lengthLineDraft, setLengthLineDraft] = useState<LineDraft | null>(null);
  const [selectedLengthLineId, setSelectedLengthLineId] = useState<string | null>(null);
  const [lengthLineLabelInput, setLengthLineLabelInput] = useState('');

  const selectedPlan = useMemo(
    () => plans?.find((candidate) => candidate.id === planId) ?? null,
    [planId, plans],
  );

  const selectedPlanId = selectedPlan?.id ?? '';
  const { data: calibration, isLoading: calibrationLoading } = usePlanCalibration(
    project.id,
    selectedPlanId,
  );
  const { data: lengthLines = [], isLoading: lengthLinesLoading } = usePlanLengthLines(
    project.id,
    selectedPlanId,
  );
  const setCalibration = useSetPlanCalibration(project.id, selectedPlanId);
  const createLengthLine = useCreatePlanLengthLine(project.id, selectedPlanId);
  const updateLengthLine = useUpdatePlanLengthLine(project.id, selectedPlanId);
  const deleteLengthLine = useDeletePlanLengthLine(project.id, selectedPlanId);

  const isCalibrated = calibration !== null || selectedPlan?.calibrationStatus === 'calibrated';
  const selectedLengthLine =
    lengthLines.find((candidate) => candidate.id === selectedLengthLineId) ?? null;

  useEffect(() => {
    if (!selectedPlan) return;
    if (!isCalibrated) {
      setActiveTool('calibrate');
    }
  }, [isCalibrated, selectedPlan]);

  useEffect(() => {
    setCalibrationDraft(null);
    setLengthLineDraft(null);
    setSelectedLengthLineId(null);
    setLengthLineLabelInput('');
  }, [selectedPlanId]);

  useEffect(() => {
    if (!calibration) return;
    setCalibrationLengthInput(formatDisplayNumber(calibration.realWorldLength));
    setCalibrationUnit(calibration.unit);
  }, [calibration]);

  useEffect(() => {
    if (lengthLineDraft) return;
    setLengthLineLabelInput(selectedLengthLine?.label ?? '');
  }, [lengthLineDraft, selectedLengthLine]);

  const calibrationPixelLength = useMemo(
    () => (calibrationDraft ? getLineLength(calibrationDraft) : null),
    [calibrationDraft],
  );
  const lengthLinePixelLength = useMemo(
    () => (lengthLineDraft ? getLineLength(lengthLineDraft) : null),
    [lengthLineDraft],
  );

  const calibrationLengthValue = Number(calibrationLengthInput);
  const canSaveCalibration =
    calibrationDraft !== null &&
    calibrationPixelLength !== null &&
    calibrationPixelLength > 0 &&
    Number.isFinite(calibrationLengthValue) &&
    calibrationLengthValue > 0 &&
    !setCalibration.isPending;

  const measuredLengthInPlanUnits =
    calibration && lengthLinePixelLength !== null
      ? lengthLinePixelLength / calibration.pixelsPerUnit
      : null;
  const measuredLengthBase =
    calibration && measuredLengthInPlanUnits !== null
      ? convertPlanUnitsToBase(measuredLengthInPlanUnits, calibration.unit)
      : null;
  const canSaveLengthLine =
    calibration !== null &&
    lengthLineDraft !== null &&
    lengthLinePixelLength !== null &&
    lengthLinePixelLength > 0 &&
    measuredLengthBase !== null &&
    !createLengthLine.isPending &&
    !updateLengthLine.isPending;

  const handleSaveCalibration = async () => {
    if (!canSaveCalibration || !calibrationDraft || calibrationPixelLength === null) return;
    await setCalibration.mutateAsync({
      startX: calibrationDraft.startX,
      startY: calibrationDraft.startY,
      endX: calibrationDraft.endX,
      endY: calibrationDraft.endY,
      realWorldLength: calibrationLengthValue,
      unit: calibrationUnit,
      pixelsPerUnit: calibrationPixelLength / calibrationLengthValue,
    });
    setCalibrationDraft(null);
  };

  const handleSaveLengthLine = async () => {
    if (!canSaveLengthLine || !lengthLineDraft || measuredLengthBase === null) return;

    const input = {
      startX: lengthLineDraft.startX,
      startY: lengthLineDraft.startY,
      endX: lengthLineDraft.endX,
      endY: lengthLineDraft.endY,
      measuredLengthBase,
      label: lengthLineLabelInput.trim() || null,
    };

    if (selectedLengthLineId) {
      const updated = await updateLengthLine.mutateAsync({ lineId: selectedLengthLineId, input });
      setSelectedLengthLineId(updated.id);
    } else {
      const created = await createLengthLine.mutateAsync(input);
      setSelectedLengthLineId(created.id);
    }

    setLengthLineDraft(null);
  };

  const handleDeleteLengthLine = async () => {
    if (!selectedLengthLine) return;
    await deleteLengthLine.mutateAsync(selectedLengthLine);
    setSelectedLengthLineId(null);
    setLengthLineDraft(null);
    setLengthLineLabelInput('');
  };

  if (isLoading) {
    return <PlanCanvasSkeleton />;
  }

  if (!selectedPlan) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">This Measured Plan could not be found.</p>
        <Link
          to={`/projects/${project.id}/plans`}
          className="mt-4 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          Back to Plans library
        </Link>
      </div>
    );
  }

  return (
    <div className="-mx-4 flex min-h-[calc(100vh-185px)] flex-col bg-[#f3f1ea] md:-mx-6">
      <header className="border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Link
              to={`/projects/${project.id}/plans`}
              className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 hover:text-brand-600"
            >
              Plans Library
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold text-neutral-900">
                {selectedPlan.name}
              </h1>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                {selectedPlan.sheetReference || 'No sheet ref'}
              </span>
              <span
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                  isCalibrated ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
                ].join(' ')}
              >
                {isCalibrated ? 'calibrated' : 'uncalibrated'}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              Saved calibration now powers reusable Length Line measurements. Draw spans directly on
              the protected plan image, save them, and reuse the recorded geometry later.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled>
              Upload replacement
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled>
              Save workspace
            </Button>
          </div>
        </div>
      </header>

      <div className="grid flex-1 gap-0 xl:grid-cols-[96px_minmax(0,1fr)_360px]">
        <aside className="border-r border-black/5 bg-white/72 p-3 backdrop-blur">
          <div className="flex flex-col gap-2">
            {TOOL_DEFINITIONS.map((tool) => {
              const disabled = tool.id !== 'calibrate' && !isCalibrated;
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveTool(tool.id)}
                  className={[
                    'rounded-2xl border px-3 py-3 text-left transition',
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-brand-200 hover:text-brand-700',
                    disabled &&
                      'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400',
                  ].join(' ')}
                  title={tool.description}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em]">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 p-4 md:p-6">
          <PlanViewport
            projectId={project.id}
            plan={selectedPlan}
            activeTool={activeTool}
            calibration={calibration}
            calibrationDraft={calibrationDraft}
            onCalibrationDraftChange={setCalibrationDraft}
            lengthLines={lengthLines}
            selectedLengthLineId={selectedLengthLineId}
            lengthLineDraft={lengthLineDraft}
            onLengthLineDraftChange={setLengthLineDraft}
          />
        </main>

        <aside className="border-l border-black/5 bg-white/72 p-4 backdrop-blur md:p-5">
          <div className="space-y-5">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Plan Selector
              </p>
              <div className="mt-3 space-y-2">
                {(plans ?? []).map((plan) => {
                  const active = plan.id === selectedPlan.id;
                  return (
                    <Link
                      key={plan.id}
                      to={`/projects/${project.id}/plans/${plan.id}`}
                      className={[
                        'block rounded-2xl border px-3 py-3 transition',
                        active
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-neutral-200 bg-white hover:border-brand-200 hover:bg-brand-50/40',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">
                            {plan.name}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {plan.sheetReference || 'No sheet reference'}
                          </p>
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                          {plan.measurementCount}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Calibration
                </p>
                {calibrationLoading ? (
                  <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                    Loading
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm font-medium text-neutral-800">
                {isCalibrated ? 'Calibrated' : 'Needs calibration'}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {activeTool === 'calibrate'
                  ? 'Click and drag on the plan to mark a reference line, then enter the documented full-size length.'
                  : 'Saved calibration is reused to convert every Length Line into a normalized measured value.'}
              </p>

              {calibration ? (
                <div className="mt-4 grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-900">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">Saved scale</span>
                    <span className="text-xs uppercase tracking-[0.18em] text-emerald-700">
                      {formatDisplayNumber(calibration.realWorldLength)} {calibration.unit}
                    </span>
                  </div>
                  <div className="text-xs leading-5 text-emerald-800">
                    {formatDisplayNumber(calibration.pixelsPerUnit)} px per {calibration.unit}
                  </div>
                </div>
              ) : null}

              {activeTool === 'calibrate' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
                    {calibrationDraft
                      ? 'Reference line captured. Enter the documented full-size length below to save or replace this plan calibration.'
                      : calibration
                        ? 'Draw a new line on the plan if you want to replace the saved calibration.'
                        : 'No reference line yet. Draw directly on the plan to start calibration.'}
                  </div>

                  {calibrationDraft ? (
                    <>
                      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold">Reference line</span>
                          <span>{formatDisplayNumber(calibrationPixelLength ?? 0)} px</span>
                        </div>
                      </div>

                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Real-world length
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={calibrationLengthInput}
                          onChange={(event) => setCalibrationLengthInput(event.target.value)}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Unit
                        </span>
                        <select
                          value={calibrationUnit}
                          onChange={(event) =>
                            setCalibrationUnit(event.target.value as PlanMeasurementUnit)
                          }
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                        >
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => void handleSaveCalibration()}
                          disabled={!canSaveCalibration}
                        >
                          {setCalibration.isPending ? 'Saving…' : 'Save calibration'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCalibrationDraft(null)}
                          disabled={setCalibration.isPending}
                        >
                          Clear line
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Length Lines
                </p>
                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-500">
                  {lengthLines.length}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-neutral-500">
                {activeTool === 'length'
                  ? 'Draw a line directly on the plan to save a measured span. Selecting an existing row lets you replace or delete it.'
                  : 'Switch to the Length Line tool to create reusable measured spans from this plan.'}
              </p>

              {activeTool === 'length' && calibration ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
                    {lengthLineDraft
                      ? selectedLengthLine
                        ? 'Replacement span captured. Save to update the selected line.'
                        : 'Span captured. Save it to create a reusable Length Line.'
                      : selectedLengthLine
                        ? 'Selected line loaded. Draw again on the plan if you want to replace its geometry.'
                        : 'No draft line yet. Draw directly on the plan to capture a measured span.'}
                  </div>

                  {lengthLineDraft ? (
                    <>
                      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold">Draft span</span>
                          <span>{formatDisplayNumber(lengthLinePixelLength ?? 0)} px</span>
                        </div>
                        <div className="mt-2 text-xs text-brand-800">
                          {measuredLengthInPlanUnits !== null
                            ? `${formatDisplayNumber(measuredLengthInPlanUnits)} ${calibration.unit}`
                            : 'Waiting for calibration'}
                        </div>
                      </div>

                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Label
                        </span>
                        <input
                          type="text"
                          value={lengthLineLabelInput}
                          onChange={(event) => setLengthLineLabelInput(event.target.value)}
                          placeholder="Optional note"
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => void handleSaveLengthLine()}
                          disabled={!canSaveLengthLine}
                        >
                          {createLengthLine.isPending || updateLengthLine.isPending
                            ? 'Saving…'
                            : selectedLengthLine
                              ? 'Update line'
                              : 'Save line'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLengthLineDraft(null)}
                          disabled={createLengthLine.isPending || updateLengthLine.isPending}
                        >
                          Clear draft
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {lengthLinesLoading ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                    Loading saved Length Lines…
                  </div>
                ) : lengthLines.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-500">
                    No saved Length Lines yet.
                  </div>
                ) : (
                  lengthLines.map((line) => {
                    const active = line.id === selectedLengthLineId;
                    const displayLength =
                      calibration && line.measuredLengthBase !== null
                        ? convertBaseToPlanUnits(line.measuredLengthBase, calibration.unit)
                        : null;

                    return (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => {
                          setSelectedLengthLineId(line.id);
                          setActiveTool('length');
                          setLengthLineDraft(null);
                          setLengthLineLabelInput(line.label ?? '');
                        }}
                        className={[
                          'block w-full rounded-2xl border px-3 py-3 text-left transition',
                          active
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-neutral-200 bg-white hover:border-brand-200 hover:bg-brand-50/40',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-900">
                              {line.label?.trim() || `Length Line ${line.id.slice(0, 4)}`}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {displayLength !== null && calibration
                                ? `${formatDisplayNumber(displayLength)} ${calibration.unit}`
                                : 'Measured span'}
                            </p>
                          </div>
                          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                            {formatDisplayNumber(getLineLength(line))} px
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedLengthLine ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedLengthLineId(null);
                      setLengthLineDraft(null);
                      setLengthLineLabelInput('');
                    }}
                  >
                    Clear selection
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDeleteLengthLine()}
                    disabled={deleteLengthLine.isPending}
                  >
                    {deleteLengthLine.isPending ? 'Deleting…' : 'Delete line'}
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Active Tool
              </p>
              <p className="mt-3 text-sm font-semibold text-neutral-900">
                {TOOL_DEFINITIONS.find((tool) => tool.id === activeTool)?.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {TOOL_DEFINITIONS.find((tool) => tool.id === activeTool)?.description}
              </p>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PlanViewport({
  projectId,
  plan,
  activeTool,
  calibration,
  calibrationDraft,
  onCalibrationDraftChange,
  lengthLines,
  selectedLengthLineId,
  lengthLineDraft,
  onLengthLineDraftChange,
}: {
  projectId: string;
  plan: MeasuredPlan;
  activeTool: ToolId;
  calibration: PlanCalibration | null | undefined;
  calibrationDraft: LineDraft | null;
  onCalibrationDraftChange: (draft: LineDraft | null) => void;
  lengthLines: LengthLine[];
  selectedLengthLineId: string | null;
  lengthLineDraft: LineDraft | null;
  onLengthLineDraftChange: (draft: LineDraft | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panDragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const lineDrawStart = useRef<ImagePoint | null>(null);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  zoomRef.current = zoom;
  offsetRef.current = offset;

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    async function loadImage() {
      setLoading(true);
      setImageUrl(null);
      try {
        const blob = await api.plans.downloadContent(projectId, plan.id);
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch {
        if (!disposed) setImageUrl(null);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void loadImage();

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [plan.id, projectId]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver !== 'function') return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      const height = entry?.contentRect.height ?? 0;
      setContainerSize({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rotatedSize = useMemo(() => {
    const quarterTurns = ((rotation % 360) + 360) % 360;
    const swap = quarterTurns === 90 || quarterTurns === 270;
    return swap
      ? { width: naturalSize.height, height: naturalSize.width }
      : { width: naturalSize.width, height: naturalSize.height };
  }, [naturalSize.height, naturalSize.width, rotation]);

  const fitScale = useMemo(() => {
    if (
      naturalSize.width <= 0 ||
      naturalSize.height <= 0 ||
      containerSize.width <= 0 ||
      containerSize.height <= 0
    ) {
      return 1;
    }

    return Math.min(
      containerSize.width / Math.max(rotatedSize.width, 1),
      containerSize.height / Math.max(rotatedSize.height, 1),
    );
  }, [
    containerSize.height,
    containerSize.width,
    naturalSize.height,
    naturalSize.width,
    rotatedSize.height,
    rotatedSize.width,
  ]);

  const effectiveScale = fitScale * zoom;
  const isCalibrating = activeTool === 'calibrate';
  const isLengthMeasuring = activeTool === 'length';
  const isDrawingLine = isCalibrating || isLengthMeasuring;

  const clampOffset = useCallback(
    (nextZoom: number, nextOffsetX: number, nextOffsetY: number) => {
      const width = rotatedSize.width * fitScale * nextZoom;
      const height = rotatedSize.height * fitScale * nextZoom;
      const maxX = Math.max(0, (width - containerSize.width) / 2);
      const maxY = Math.max(0, (height - containerSize.height) / 2);

      return {
        x: Math.max(-maxX, Math.min(maxX, nextOffsetX)),
        y: Math.max(-maxY, Math.min(maxY, nextOffsetY)),
      };
    },
    [containerSize.height, containerSize.width, fitScale, rotatedSize.height, rotatedSize.width],
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const rotateClockwise = useCallback(() => {
    setRotation((current) => (current + 90) % 360);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const imagePointFromClient = useCallback(
    (clientX: number, clientY: number, clamp = false): ImagePoint | null => {
      const element = containerRef.current;
      if (!element || naturalSize.width <= 0 || naturalSize.height <= 0 || effectiveScale <= 0) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const centeredX = clientX - rect.left - rect.width / 2 - offset.x;
      const centeredY = clientY - rect.top - rect.height / 2 - offset.y;
      const radians = (-rotation * Math.PI) / 180;
      const unrotatedX = centeredX * Math.cos(radians) - centeredY * Math.sin(radians);
      const unrotatedY = centeredX * Math.sin(radians) + centeredY * Math.cos(radians);
      const imageX = unrotatedX / effectiveScale + naturalSize.width / 2;
      const imageY = unrotatedY / effectiveScale + naturalSize.height / 2;

      if (!clamp) {
        if (imageX < 0 || imageX > naturalSize.width || imageY < 0 || imageY > naturalSize.height) {
          return null;
        }
        return { x: imageX, y: imageY };
      }

      return {
        x: Math.max(0, Math.min(naturalSize.width, imageX)),
        y: Math.max(0, Math.min(naturalSize.height, imageY)),
      };
    },
    [effectiveScale, naturalSize.height, naturalSize.width, offset.x, offset.y, rotation],
  );

  const viewportPointFromImage = useCallback(
    (point: ImagePoint): ImagePoint => {
      const centeredX = (point.x - naturalSize.width / 2) * effectiveScale;
      const centeredY = (point.y - naturalSize.height / 2) * effectiveScale;
      const radians = (rotation * Math.PI) / 180;
      const rotatedX = centeredX * Math.cos(radians) - centeredY * Math.sin(radians);
      const rotatedY = centeredX * Math.sin(radians) + centeredY * Math.cos(radians);
      return {
        x: containerSize.width / 2 + offset.x + rotatedX,
        y: containerSize.height / 2 + offset.y + rotatedY,
      };
    },
    [
      containerSize.height,
      containerSize.width,
      effectiveScale,
      naturalSize.height,
      naturalSize.width,
      offset.x,
      offset.y,
      rotation,
    ],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const onWheel = (event: WheelEvent) => {
      if (!imageUrl) return;
      event.preventDefault();

      const rect = element.getBoundingClientRect();
      const cursorX = event.clientX - rect.left - rect.width / 2;
      const cursorY = event.clientY - rect.top - rect.height / 2;
      const previousZoom = zoomRef.current;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = Math.max(1, Math.min(5, previousZoom * factor));
      const ratio = nextZoom / previousZoom;
      const nextOffsetX = cursorX + (offsetRef.current.x - cursorX) * ratio;
      const nextOffsetY = cursorY + (offsetRef.current.y - cursorY) * ratio;

      setZoom(nextZoom);
      setOffset(clampOffset(nextZoom, nextOffsetX, nextOffsetY));
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [clampOffset, imageUrl]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageUrl || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (isDrawingLine) {
      const point = imagePointFromClient(event.clientX, event.clientY);
      if (!point) return;
      lineDrawStart.current = point;
      if (isCalibrating) {
        onCalibrationDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      } else {
        onLengthLineDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      }
      return;
    }

    panDragStart.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lineDrawStart.current && isDrawingLine) {
      const point = imagePointFromClient(event.clientX, event.clientY, true);
      if (!point) return;
      const nextDraft = {
        startX: lineDrawStart.current.x,
        startY: lineDrawStart.current.y,
        endX: point.x,
        endY: point.y,
      };
      if (isCalibrating) {
        onCalibrationDraftChange(nextDraft);
      } else {
        onLengthLineDraftChange(nextDraft);
      }
      return;
    }

    if (!panDragStart.current) return;
    const deltaX = event.clientX - panDragStart.current.px;
    const deltaY = event.clientY - panDragStart.current.py;
    setOffset(
      clampOffset(zoom, panDragStart.current.ox + deltaX, panDragStart.current.oy + deltaY),
    );
  };

  const handlePointerUp = () => {
    panDragStart.current = null;
    lineDrawStart.current = null;
  };

  const showReset = zoom > 1.01 || rotation !== 0 || offset.x !== 0 || offset.y !== 0;
  const savedCalibrationLine = calibration
    ? {
        startX: calibration.startX,
        startY: calibration.startY,
        endX: calibration.endX,
        endY: calibration.endY,
      }
    : null;

  const savedCalibrationPoints = savedCalibrationLine
    ? {
        start: viewportPointFromImage({
          x: savedCalibrationLine.startX,
          y: savedCalibrationLine.startY,
        }),
        end: viewportPointFromImage({ x: savedCalibrationLine.endX, y: savedCalibrationLine.endY }),
      }
    : null;

  const draftCalibrationPoints = calibrationDraft
    ? {
        start: viewportPointFromImage({ x: calibrationDraft.startX, y: calibrationDraft.startY }),
        end: viewportPointFromImage({ x: calibrationDraft.endX, y: calibrationDraft.endY }),
      }
    : null;

  const draftLengthPoints = lengthLineDraft
    ? {
        start: viewportPointFromImage({ x: lengthLineDraft.startX, y: lengthLineDraft.startY }),
        end: viewportPointFromImage({ x: lengthLineDraft.endX, y: lengthLineDraft.endY }),
      }
    : null;

  return (
    <div className="grid h-full gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/72 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setZoom((current) => Math.min(5, current * 1.15))}
          >
            Zoom in
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setZoom((current) => {
                const nextZoom = Math.max(1, current / 1.15);
                setOffset((currentOffset) =>
                  clampOffset(nextZoom, currentOffset.x, currentOffset.y),
                );
                return nextZoom;
              });
            }}
          >
            Zoom out
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={rotateClockwise}>
            Rotate 90°
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetView} disabled={!showReset}>
            Reset view
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
          <span>{Math.round(zoom * 100)}%</span>
          <span>{rotation}°</span>
          <span>{plan.imageFilename}</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[58vh] overflow-hidden rounded-[28px] border border-black/5 bg-[#e7dfd1] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        style={{
          cursor: imageUrl
            ? isDrawingLine
              ? 'crosshair'
              : panDragStart.current
                ? 'grabbing'
                : 'grab'
            : 'default',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={resetView}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_54%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 text-sm text-neutral-500 backdrop-blur">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Loading measured plan…
            </div>
          </div>
        ) : null}

        {!loading && !imageUrl ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm leading-6 text-neutral-500">
            The protected source image could not be loaded for this Measured Plan.
          </div>
        ) : null}

        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={plan.name}
              draggable={false}
              onLoad={(event) =>
                setNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              className="pointer-events-none absolute left-1/2 top-1/2 select-none"
              style={{
                width: naturalSize.width || undefined,
                height: naturalSize.height || undefined,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${effectiveScale})`,
                transformOrigin: 'center center',
                transition:
                  panDragStart.current || lineDrawStart.current
                    ? 'none'
                    : 'transform 0.08s ease-out',
              }}
            />

            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {savedCalibrationPoints ? (
                <LineOverlay
                  start={savedCalibrationPoints.start}
                  end={savedCalibrationPoints.end}
                  strokeClassName="stroke-emerald-500"
                  dotClassName="fill-emerald-500"
                />
              ) : null}

              {lengthLines.map((line) => {
                const points = {
                  start: viewportPointFromImage({ x: line.startX, y: line.startY }),
                  end: viewportPointFromImage({ x: line.endX, y: line.endY }),
                };
                const active = line.id === selectedLengthLineId;
                return (
                  <LineOverlay
                    key={line.id}
                    start={points.start}
                    end={points.end}
                    strokeClassName={active ? 'stroke-brand-700' : 'stroke-[#8b6f47]'}
                    dotClassName={active ? 'fill-brand-700' : 'fill-[#8b6f47]'}
                    label={line.label?.trim() || undefined}
                  />
                );
              })}

              {draftCalibrationPoints ? (
                <LineOverlay
                  start={draftCalibrationPoints.start}
                  end={draftCalibrationPoints.end}
                  strokeClassName="stroke-brand-600"
                  dotClassName="fill-brand-600"
                  dashed
                />
              ) : null}

              {draftLengthPoints ? (
                <LineOverlay
                  start={draftLengthPoints.start}
                  end={draftLengthPoints.end}
                  strokeClassName="stroke-[#c17a00]"
                  dotClassName="fill-[#c17a00]"
                  dashed
                  label={selectedLengthLineId ? 'Replacement' : 'Draft'}
                />
              ) : null}
            </svg>

            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 backdrop-blur">
              {isCalibrating
                ? 'Draw calibration line • scroll to zoom • double-click to reset'
                : isLengthMeasuring
                  ? 'Draw measured line • scroll to zoom • double-click to reset'
                  : 'Scroll to zoom • drag to pan • double-click to reset'}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function LineOverlay({
  start,
  end,
  strokeClassName,
  dotClassName,
  dashed = false,
  label,
}: {
  start: ImagePoint;
  end: ImagePoint;
  strokeClassName: string;
  dotClassName: string;
  dashed?: boolean;
  label?: string | undefined;
}) {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        className={strokeClassName}
        strokeWidth={3}
        strokeDasharray={dashed ? '10 8' : undefined}
        strokeLinecap="round"
      />
      <circle cx={start.x} cy={start.y} r={5} className={dotClassName} />
      <circle cx={end.x} cy={end.y} r={5} className={dotClassName} />
      {label ? (
        <g>
          <rect
            x={midX - 42}
            y={midY - 20}
            width={84}
            height={18}
            rx={9}
            fill="rgba(255,255,255,0.82)"
          />
          <text
            x={midX}
            y={midY - 8}
            textAnchor="middle"
            fill="#3f3f46"
            fontSize="11"
            fontWeight="600"
            letterSpacing="0.08em"
          >
            {label}
          </text>
        </g>
      ) : null}
    </>
  );
}

function getLineLength(line: Pick<LineDraft, 'startX' | 'startY' | 'endX' | 'endY'>) {
  return Math.hypot(line.endX - line.startX, line.endY - line.startY);
}

function convertPlanUnitsToBase(value: number, unit: PlanMeasurementUnit) {
  return value * MILLIMETERS_PER_UNIT[unit];
}

function convertBaseToPlanUnits(value: number, unit: PlanMeasurementUnit) {
  return value / MILLIMETERS_PER_UNIT[unit];
}

function formatDisplayNumber(value: number) {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
}

function PlanCanvasSkeleton() {
  return (
    <div className="-mx-4 grid min-h-[calc(100vh-185px)] gap-0 bg-[#f3f1ea] md:-mx-6 xl:grid-cols-[96px_minmax(0,1fr)_360px]">
      <div className="border-r border-black/5 bg-white/72 p-3">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
      <div className="p-6">
        <div className="h-full min-h-[70vh] animate-pulse rounded-[28px] bg-white/70" />
      </div>
      <div className="border-l border-black/5 bg-white/72 p-4">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
