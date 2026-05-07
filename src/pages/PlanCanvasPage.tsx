import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LineOverlay, RectOverlay } from '../components/plans/overlays';
import { Button } from '../components/primitives';
import {
  useCreatePlanLengthLine,
  useCreatePlanMeasurement,
  useDeletePlanLengthLine,
  useDeletePlanMeasurement,
  useMeasuredPlans,
  usePlanCalibration,
  usePlanLengthLines,
  usePlanMeasurements,
  useSetPlanCalibration,
  useUpdatePlanLengthLine,
  useUpdatePlanMeasurement,
} from '../hooks';
import { api } from '../lib/api';
import {
  buildRectPolygonPoints,
  clampPointToRect,
  getLineLength,
  measurementToRectBounds,
  normalizeRectDraft,
  type ImagePoint,
  type LineDraft,
  type RectDraft,
} from '../lib/plans/geometry';
import { imageKeys } from '../hooks/queryKeys';
import type {
  CropParams,
  LengthLine,
  Measurement,
  MeasuredPlan,
  PlanCalibration,
  PlanMeasurementUnit,
  Project,
  ProposalCategoryWithItems,
  RoomWithItems,
} from '../types';

type PlanCanvasPageProps = {
  project: Project;
  planId: string;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
};

type ToolId = 'calibrate' | 'length' | 'rectangle' | 'crop';

type MeasurementItemRef = {
  key: string;
  targetKind: Measurement['targetKind'];
  targetItemId: string;
  targetTagSnapshot: string;
  primaryLabel: string;
  secondaryLabel: string;
  containerLabel: string;
};

const TOOL_DEFINITIONS: Array<{
  id: ToolId;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: 'calibrate',
    label: 'Calibrate',
    description: 'Set the plan scale from a reference line.',
    icon: <CalibrateIcon />,
  },
  {
    id: 'length',
    label: 'Length Line',
    description: 'Measure and save linear spans on the plan.',
    icon: <LengthLineIcon />,
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'Capture an item footprint and associate it with an item.',
    icon: <RectangleIcon />,
  },
  {
    id: 'crop',
    label: 'Crop',
    description: 'Refine the derived plan image framing.',
    icon: <CropIcon />,
  },
];

const UNIT_OPTIONS: PlanMeasurementUnit[] = ['ft', 'in', 'm', 'cm', 'mm'];
const MILLIMETERS_PER_UNIT: Record<PlanMeasurementUnit, number> = {
  ft: 304.8,
  in: 25.4,
  mm: 1,
  cm: 10,
  m: 1000,
};

function sectionForTool(tool: ToolId) {
  return tool === 'calibrate' ? 'calibration' : tool === 'length' ? 'length' : 'items';
}

export function PlanCanvasPage({
  project,
  planId,
  roomsWithItems,
  proposalCategoriesWithItems,
}: PlanCanvasPageProps) {
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useMeasuredPlans(project.id);
  const [activeTool, setActiveTool] = useState<ToolId>('calibrate');
  const [calibrationDraft, setCalibrationDraft] = useState<LineDraft | null>(null);
  const [calibrationLengthInput, setCalibrationLengthInput] = useState('1');
  const [calibrationUnit, setCalibrationUnit] = useState<PlanMeasurementUnit>('ft');
  const [lengthLineDraft, setLengthLineDraft] = useState<LineDraft | null>(null);
  const [selectedLengthLineId, setSelectedLengthLineId] = useState<string | null>(null);
  const [lengthLineLabelInput, setLengthLineLabelInput] = useState('');
  const [measurementDraft, setMeasurementDraft] = useState<RectDraft | null>(null);
  const [cropDraft, setCropDraft] = useState<RectDraft | null>(null);
  const [planNaturalSize, setPlanNaturalSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedMeasurementTargetKey, setSelectedMeasurementTargetKey] = useState('');
  const [openSection, setOpenSection] = useState<string>('calibration');
  const [isSavingPlanImage, setIsSavingPlanImage] = useState(false);

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
  const { data: measurements = [], isLoading: measurementsLoading } = usePlanMeasurements(
    project.id,
    selectedPlanId,
  );
  const setCalibration = useSetPlanCalibration(project.id, selectedPlanId);
  const createLengthLine = useCreatePlanLengthLine(project.id, selectedPlanId);
  const updateLengthLine = useUpdatePlanLengthLine(project.id, selectedPlanId);
  const deleteLengthLine = useDeletePlanLengthLine(project.id, selectedPlanId);
  const createMeasurement = useCreatePlanMeasurement(project.id, selectedPlanId);
  const updateMeasurement = useUpdatePlanMeasurement(project.id, selectedPlanId);
  const deleteMeasurement = useDeletePlanMeasurement(project.id, selectedPlanId);

  const measurementItems = useMemo(
    () => buildMeasurementItems(roomsWithItems, proposalCategoriesWithItems),
    [proposalCategoriesWithItems, roomsWithItems],
  );
  const measurementItemsByKey = useMemo(
    () => new Map(measurementItems.map((item) => [item.key, item])),
    [measurementItems],
  );
  const measurementItemsByMeasurementId = useMemo(() => {
    const result = new Map<string, MeasurementItemRef>();
    for (const measurement of measurements) {
      const key = `${measurement.targetKind}:${measurement.targetItemId}`;
      const item = measurementItemsByKey.get(key);
      if (item) result.set(measurement.id, item);
    }
    return result;
  }, [measurementItemsByKey, measurements]);

  const isCalibrated = calibration !== null || selectedPlan?.calibrationStatus === 'calibrated';
  const selectedLengthLine =
    lengthLines.find((candidate) => candidate.id === selectedLengthLineId) ?? null;
  const selectedMeasurement =
    measurements.find((candidate) => candidate.id === selectedMeasurementId) ?? null;
  const selectedMeasurementItem = selectedMeasurement
    ? (measurementItemsByMeasurementId.get(selectedMeasurement.id) ?? null)
    : null;

  useEffect(() => {
    if (!selectedPlan) return;
    if (!isCalibrated) {
      setActiveTool('calibrate');
    }
  }, [isCalibrated, selectedPlan]);

  useEffect(() => {
    setOpenSection(sectionForTool(activeTool));
  }, [activeTool]);

  useEffect(() => {
    setCalibrationDraft(null);
    setLengthLineDraft(null);
    setMeasurementDraft(null);
    setCropDraft(null);
    setPlanNaturalSize({ width: 0, height: 0 });
    setSelectedLengthLineId(null);
    setSelectedMeasurementId(null);
    setSelectedMeasurementTargetKey('');
    setLengthLineLabelInput('');
    setOpenSection(sectionForTool('calibrate'));
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

  useEffect(() => {
    if (!selectedMeasurementItem || measurementDraft) return;
    setSelectedMeasurementTargetKey(selectedMeasurementItem.key);
  }, [measurementDraft, selectedMeasurementItem]);

  const calibrationPixelLength = useMemo(
    () => (calibrationDraft ? getLineLength(calibrationDraft) : null),
    [calibrationDraft],
  );
  const lengthLinePixelLength = useMemo(
    () => (lengthLineDraft ? getLineLength(lengthLineDraft) : null),
    [lengthLineDraft],
  );
  const normalizedMeasurementDraft = useMemo(
    () => (measurementDraft ? normalizeRectDraft(measurementDraft) : null),
    [measurementDraft],
  );
  const normalizedCropDraft = useMemo(
    () => (cropDraft ? normalizeRectDraft(cropDraft) : null),
    [cropDraft],
  );
  const selectedMeasurementRect = useMemo(
    () => (selectedMeasurement ? measurementToRectBounds(selectedMeasurement) : null),
    [selectedMeasurement],
  );

  const calibrationLengthValue = Number(calibrationLengthInput);
  const canSaveCalibration =
    calibrationDraft !== null &&
    calibrationPixelLength !== null &&
    calibrationPixelLength > 0 &&
    Number.isFinite(calibrationLengthValue) &&
    calibrationLengthValue > 0 &&
    !setCalibration.isPending;

  const draftLengthInPlanUnits =
    calibration && lengthLinePixelLength !== null
      ? lengthLinePixelLength / calibration.pixelsPerUnit
      : null;
  const draftLengthBase =
    calibration && draftLengthInPlanUnits !== null
      ? convertPlanUnitsToBase(draftLengthInPlanUnits, calibration.unit)
      : null;
  const canSaveLengthLine =
    calibration !== null &&
    lengthLineDraft !== null &&
    lengthLinePixelLength !== null &&
    lengthLinePixelLength > 0 &&
    draftLengthBase !== null &&
    !createLengthLine.isPending &&
    !updateLengthLine.isPending;

  const draftMeasurementWidthPlanUnits =
    calibration && normalizedMeasurementDraft
      ? normalizedMeasurementDraft.width / calibration.pixelsPerUnit
      : null;
  const draftMeasurementHeightPlanUnits =
    calibration && normalizedMeasurementDraft
      ? normalizedMeasurementDraft.height / calibration.pixelsPerUnit
      : null;
  const draftMeasurementWidthBase =
    calibration && draftMeasurementWidthPlanUnits !== null
      ? convertPlanUnitsToBase(draftMeasurementWidthPlanUnits, calibration.unit)
      : null;
  const draftMeasurementHeightBase =
    calibration && draftMeasurementHeightPlanUnits !== null
      ? convertPlanUnitsToBase(draftMeasurementHeightPlanUnits, calibration.unit)
      : null;
  const selectedMeasurementTarget =
    selectedMeasurementTargetKey.length > 0
      ? (measurementItemsByKey.get(selectedMeasurementTargetKey) ?? null)
      : null;
  const canSaveMeasurement =
    calibration !== null &&
    normalizedMeasurementDraft !== null &&
    draftMeasurementWidthBase !== null &&
    draftMeasurementHeightBase !== null &&
    selectedMeasurementTarget !== null &&
    !createMeasurement.isPending &&
    !updateMeasurement.isPending;
  const draftCropWidthPlanUnits =
    calibration && normalizedCropDraft
      ? normalizedCropDraft.width / calibration.pixelsPerUnit
      : null;
  const draftCropHeightPlanUnits =
    calibration && normalizedCropDraft
      ? normalizedCropDraft.height / calibration.pixelsPerUnit
      : null;
  const canSaveCrop =
    selectedMeasurement !== null &&
    normalizedCropDraft !== null &&
    normalizedCropDraft.width > 0 &&
    normalizedCropDraft.height > 0 &&
    !updateMeasurement.isPending;
  const savedCropParams =
    selectedMeasurement &&
    selectedMeasurement.cropX !== null &&
    selectedMeasurement.cropY !== null &&
    selectedMeasurement.cropWidth !== null &&
    selectedMeasurement.cropHeight !== null
      ? ({
          cropX: selectedMeasurement.cropX,
          cropY: selectedMeasurement.cropY,
          cropWidth: selectedMeasurement.cropWidth,
          cropHeight: selectedMeasurement.cropHeight,
        } satisfies CropParams)
      : null;
  const canSavePlanImage =
    selectedMeasurement?.targetKind === 'proposal' &&
    savedCropParams !== null &&
    planNaturalSize.width > 0 &&
    planNaturalSize.height > 0 &&
    !isSavingPlanImage;

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
    if (!canSaveLengthLine || !lengthLineDraft || draftLengthBase === null) return;

    const input = {
      startX: lengthLineDraft.startX,
      startY: lengthLineDraft.startY,
      endX: lengthLineDraft.endX,
      endY: lengthLineDraft.endY,
      measuredLengthBase: draftLengthBase,
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

  const handleSaveMeasurement = async () => {
    if (
      !canSaveMeasurement ||
      !normalizedMeasurementDraft ||
      !selectedMeasurementTarget ||
      draftMeasurementWidthBase === null ||
      draftMeasurementHeightBase === null
    ) {
      return;
    }

    const input = {
      targetKind: selectedMeasurementTarget.targetKind,
      targetItemId: selectedMeasurementTarget.targetItemId,
      targetTagSnapshot: selectedMeasurementTarget.targetTagSnapshot,
      rectX: normalizedMeasurementDraft.x,
      rectY: normalizedMeasurementDraft.y,
      rectWidth: normalizedMeasurementDraft.width,
      rectHeight: normalizedMeasurementDraft.height,
      horizontalSpanBase: draftMeasurementWidthBase,
      verticalSpanBase: draftMeasurementHeightBase,
      cropX: null,
      cropY: null,
      cropWidth: null,
      cropHeight: null,
    };

    if (selectedMeasurementId) {
      const updated = await updateMeasurement.mutateAsync({
        measurementId: selectedMeasurementId,
        input,
      });
      setSelectedMeasurementId(updated.id);
    } else {
      const created = await createMeasurement.mutateAsync(input);
      setSelectedMeasurementId(created.id);
    }

    setMeasurementDraft(null);
  };

  const handleDeleteMeasurement = async () => {
    if (!selectedMeasurement) return;
    await deleteMeasurement.mutateAsync(selectedMeasurement);
    setSelectedMeasurementId(null);
    setMeasurementDraft(null);
    setCropDraft(null);
    setSelectedMeasurementTargetKey('');
  };

  const handleSaveCrop = async () => {
    if (!selectedMeasurement || !normalizedCropDraft) return;

    const updated = await updateMeasurement.mutateAsync({
      measurementId: selectedMeasurement.id,
      input: {
        targetKind: selectedMeasurement.targetKind,
        targetItemId: selectedMeasurement.targetItemId,
        targetTagSnapshot: selectedMeasurement.targetTagSnapshot,
        rectX: selectedMeasurement.rectX,
        rectY: selectedMeasurement.rectY,
        rectWidth: selectedMeasurement.rectWidth,
        rectHeight: selectedMeasurement.rectHeight,
        horizontalSpanBase: selectedMeasurement.horizontalSpanBase,
        verticalSpanBase: selectedMeasurement.verticalSpanBase,
        cropX: normalizedCropDraft.x,
        cropY: normalizedCropDraft.y,
        cropWidth: normalizedCropDraft.width,
        cropHeight: normalizedCropDraft.height,
      },
    });

    setSelectedMeasurementId(updated.id);
    setCropDraft(null);
  };

  const handleClearSavedCrop = async () => {
    if (!selectedMeasurement) return;

    const updated = await updateMeasurement.mutateAsync({
      measurementId: selectedMeasurement.id,
      input: {
        targetKind: selectedMeasurement.targetKind,
        targetItemId: selectedMeasurement.targetItemId,
        targetTagSnapshot: selectedMeasurement.targetTagSnapshot,
        rectX: selectedMeasurement.rectX,
        rectY: selectedMeasurement.rectY,
        rectWidth: selectedMeasurement.rectWidth,
        rectHeight: selectedMeasurement.rectHeight,
        horizontalSpanBase: selectedMeasurement.horizontalSpanBase,
        verticalSpanBase: selectedMeasurement.verticalSpanBase,
        cropX: null,
        cropY: null,
        cropWidth: null,
        cropHeight: null,
      },
    });

    setSelectedMeasurementId(updated.id);
    setCropDraft(null);
  };

  const handleSavePlanImage = async () => {
    if (
      !selectedMeasurement ||
      selectedMeasurement.targetKind !== 'proposal' ||
      !savedCropParams ||
      !selectedPlan ||
      planNaturalSize.width <= 0 ||
      planNaturalSize.height <= 0
    ) {
      return;
    }

    setIsSavingPlanImage(true);
    try {
      const existingImages = await api.images.list({
        entityType: 'proposal_plan',
        entityId: selectedMeasurement.targetItemId,
      });

      if (existingImages.length > 0) {
        await Promise.all(existingImages.map((image) => api.images.delete(image.id)));
      }

      const sourceBlob = await api.plans.downloadContent(project.id, selectedPlanId);
      const sourceType = sourceBlob.type || selectedPlan.imageContentType || 'image/png';
      const extension = sourceType.split('/')[1] || 'png';
      const uploadFile = new File([sourceBlob], `${selectedPlan.name}-plan.${extension}`, {
        type: sourceType,
      });

      const uploadedImage = await api.images.upload({
        entityType: 'proposal_plan',
        entityId: selectedMeasurement.targetItemId,
        file: uploadFile,
        altText: `${selectedMeasurement.targetTagSnapshot} plan image`,
      });

      const croppedImage = await api.images.setCrop(uploadedImage.id, {
        cropX: savedCropParams.cropX / planNaturalSize.width,
        cropY: savedCropParams.cropY / planNaturalSize.height,
        cropWidth: savedCropParams.cropWidth / planNaturalSize.width,
        cropHeight: savedCropParams.cropHeight / planNaturalSize.height,
      });

      queryClient.setQueryData(
        imageKeys.forEntity('proposal_plan', selectedMeasurement.targetItemId),
        [croppedImage],
      );
    } finally {
      setIsSavingPlanImage(false);
    }
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f3f1ea]">
      <header className="border-b border-black/5 bg-white/88 px-4 py-3 backdrop-blur md:px-6">
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
              This workspace is now fixed-height and full-window so plan geometry stays visually
              stable while you measure. Use the icon rail to calibrate, save line spans, or link a
              measured rectangle to an item.
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[84px_minmax(0,1fr)_380px]">
        <aside className="overflow-y-auto border-r border-black/5 bg-white/72 p-3 backdrop-blur">
          <div className="flex flex-col gap-2">
            {TOOL_DEFINITIONS.map((tool) => {
              const disabled = tool.id !== 'calibrate' && !isCalibrated;
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  aria-label={tool.label}
                  title={`${tool.label}: ${tool.description}`}
                  disabled={disabled}
                  onClick={() => setActiveTool(tool.id)}
                  className={[
                    'flex h-14 w-14 items-center justify-center rounded-2xl border transition',
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-brand-200 hover:text-brand-700',
                    disabled &&
                      'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400',
                  ].join(' ')}
                >
                  <span className="sr-only">{tool.label}</span>
                  {tool.icon}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-h-0 overflow-hidden p-4 md:p-6">
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
            measurements={measurements}
            selectedMeasurementId={selectedMeasurementId}
            measurementDraft={measurementDraft}
            onMeasurementDraftChange={setMeasurementDraft}
            cropDraft={cropDraft}
            onCropDraftChange={setCropDraft}
            onNaturalSizeChange={setPlanNaturalSize}
          />
        </main>

        <aside className="overflow-y-auto border-l border-black/5 bg-white/72 p-4 backdrop-blur md:p-5">
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
              <button
                type="button"
                onClick={() => setOpenSection('calibration')}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Calibration
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                  {calibrationLoading
                    ? 'Loading…'
                    : openSection === 'calibration'
                      ? 'Hide'
                      : 'Show'}
                </span>
              </button>
              {openSection === 'calibration' ? (
                <>
                  <p className="mt-3 text-sm font-medium text-neutral-800">
                    {isCalibrated ? 'Calibrated' : 'Needs calibration'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    {activeTool === 'calibrate'
                      ? 'Draw a reference line directly on the plan, then enter the documented full-size length.'
                      : 'Saved calibration is reused for all line and rectangle measurements on this plan.'}
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
                </>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setOpenSection('length')}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Length Lines
                </span>
                <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-500">
                    {lengthLines.length}
                  </span>
                  <span>{openSection === 'length' ? 'Hide' : 'Show'}</span>
                </span>
              </button>
              {openSection === 'length' ? (
                <>
                  {activeTool === 'length' ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
                        {lengthLineDraft
                          ? selectedLengthLine
                            ? 'Replacement span captured. Save to update the selected line.'
                            : 'Span captured. Save it to create a reusable Length Line.'
                          : 'Draw a span directly on the plan to capture a measured line.'}
                      </div>

                      {lengthLineDraft ? (
                        <>
                          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="font-semibold">Draft span</span>
                              <span>{formatDisplayNumber(lengthLinePixelLength ?? 0)} px</span>
                            </div>
                            <div className="mt-2 text-xs text-brand-800">
                              {draftLengthInPlanUnits !== null && calibration
                                ? `${formatDisplayNumber(draftLengthInPlanUnits)} ${calibration.unit}`
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
                </>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setOpenSection('items')}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Measured Items
                </span>
                <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-500">
                    {measurements.length}
                  </span>
                  <span>{openSection === 'items' ? 'Hide' : 'Show'}</span>
                </span>
              </button>

              {openSection === 'items' ? (
                <>
                  {activeTool === 'rectangle' ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
                        {measurementDraft
                          ? selectedMeasurement
                            ? 'Replacement rectangle captured. Choose the item and save to update.'
                            : 'Rectangle captured. Choose the item and save to create a measured area.'
                          : 'Draw a rectangle directly on the plan, then associate it with an item below.'}
                      </div>

                      {normalizedMeasurementDraft ? (
                        <>
                          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="font-semibold">Draft area</span>
                              <span>
                                {formatDisplayNumber(normalizedMeasurementDraft.width)} ×{' '}
                                {formatDisplayNumber(normalizedMeasurementDraft.height)} px
                              </span>
                            </div>
                            {calibration ? (
                              <div className="mt-2 text-xs text-brand-800">
                                {draftMeasurementWidthPlanUnits !== null &&
                                draftMeasurementHeightPlanUnits !== null
                                  ? `${formatDisplayNumber(draftMeasurementWidthPlanUnits)} ${calibration.unit} × ${formatDisplayNumber(draftMeasurementHeightPlanUnits)} ${calibration.unit}`
                                  : 'Waiting for calibration'}
                              </div>
                            ) : null}
                          </div>

                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                              Associate with item
                            </span>
                            <select
                              value={selectedMeasurementTargetKey}
                              onChange={(event) =>
                                setSelectedMeasurementTargetKey(event.target.value)
                              }
                              className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                            >
                              <option value="">Select an item</option>
                              {measurementItems.map((item) => (
                                <option key={item.key} value={item.key}>
                                  {`${item.primaryLabel} — ${item.secondaryLabel} (${item.containerLabel})`}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => void handleSaveMeasurement()}
                              disabled={!canSaveMeasurement}
                            >
                              {createMeasurement.isPending || updateMeasurement.isPending
                                ? 'Saving…'
                                : selectedMeasurement
                                  ? 'Update measurement'
                                  : 'Save measurement'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setMeasurementDraft(null)}
                              disabled={createMeasurement.isPending || updateMeasurement.isPending}
                            >
                              Clear draft
                            </Button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {activeTool === 'crop' ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
                        {!selectedMeasurement
                          ? 'Select a measured item below, then draw a crop rectangle inside its highlighted area.'
                          : normalizedCropDraft
                            ? 'Crop area captured. Save it to refine the stored plan image framing for this item.'
                            : selectedMeasurement.cropWidth !== null &&
                                selectedMeasurement.cropHeight !== null
                              ? 'A saved crop already exists for this measured item. Draw a new one to replace it.'
                              : 'Draw a crop rectangle inside the selected measured area to define the plan image framing.'}
                      </div>

                      {selectedMeasurementRect ? (
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-700">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold">Selected area</span>
                            <span>
                              {formatDisplayNumber(selectedMeasurementRect.width)} ×{' '}
                              {formatDisplayNumber(selectedMeasurementRect.height)} px
                            </span>
                          </div>
                          {calibration && selectedMeasurement ? (
                            <div className="mt-2 text-xs text-neutral-500">
                              {`${formatDisplayNumber(convertBaseToPlanUnits(selectedMeasurement.horizontalSpanBase, calibration.unit))} ${calibration.unit} × ${formatDisplayNumber(convertBaseToPlanUnits(selectedMeasurement.verticalSpanBase, calibration.unit))} ${calibration.unit}`}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {normalizedCropDraft ? (
                        <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold">Draft crop</span>
                            <span>
                              {formatDisplayNumber(normalizedCropDraft.width)} ×{' '}
                              {formatDisplayNumber(normalizedCropDraft.height)} px
                            </span>
                          </div>
                          {calibration ? (
                            <div className="mt-2 text-xs text-brand-800">
                              {draftCropWidthPlanUnits !== null && draftCropHeightPlanUnits !== null
                                ? `${formatDisplayNumber(draftCropWidthPlanUnits)} ${calibration.unit} × ${formatDisplayNumber(draftCropHeightPlanUnits)} ${calibration.unit}`
                                : 'Waiting for calibration'}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {selectedMeasurement &&
                      selectedMeasurement.cropWidth !== null &&
                      selectedMeasurement.cropHeight !== null ? (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold">Saved crop</span>
                            <span>
                              {formatDisplayNumber(selectedMeasurement.cropWidth)} ×{' '}
                              {formatDisplayNumber(selectedMeasurement.cropHeight)} px
                            </span>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => void handleSaveCrop()}
                          disabled={!canSaveCrop}
                        >
                          {updateMeasurement.isPending ? 'Saving…' : 'Save crop'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCropDraft(null)}
                          disabled={!normalizedCropDraft || updateMeasurement.isPending}
                        >
                          Clear draft
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleClearSavedCrop()}
                          disabled={
                            !selectedMeasurement ||
                            selectedMeasurement.cropWidth === null ||
                            selectedMeasurement.cropHeight === null ||
                            updateMeasurement.isPending
                          }
                        >
                          Remove saved crop
                        </Button>
                        {selectedMeasurement?.targetKind === 'proposal' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleSavePlanImage()}
                            disabled={!canSavePlanImage}
                          >
                            {isSavingPlanImage ? 'Saving plan image…' : 'Save as plan image'}
                          </Button>
                        ) : null}
                      </div>
                      {selectedMeasurement?.targetKind === 'proposal' ? (
                        <p className="text-xs leading-5 text-neutral-500">
                          This saves the selected crop as the Proposal item&apos;s Plan image so it
                          appears in the Proposal table and detail panel.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {measurementsLoading ? (
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                        Loading measured items…
                      </div>
                    ) : measurements.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-500">
                        No measured items yet.
                      </div>
                    ) : (
                      measurements.map((measurement) => {
                        const item = measurementItemsByMeasurementId.get(measurement.id);
                        const active = measurement.id === selectedMeasurementId;
                        return (
                          <button
                            key={measurement.id}
                            type="button"
                            onClick={() => {
                              setSelectedMeasurementId(measurement.id);
                              setActiveTool((currentTool) =>
                                currentTool === 'crop' ? 'crop' : 'rectangle',
                              );
                              setMeasurementDraft(null);
                              setCropDraft(null);
                              if (item) setSelectedMeasurementTargetKey(item.key);
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
                                  {item?.primaryLabel ?? measurement.targetTagSnapshot}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">
                                  {item
                                    ? `${item.secondaryLabel} • ${item.containerLabel}`
                                    : measurement.targetKind === 'ffe'
                                      ? 'FF&E item'
                                      : 'Proposal item'}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedMeasurement ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedMeasurementId(null);
                          setMeasurementDraft(null);
                          setCropDraft(null);
                          setSelectedMeasurementTargetKey('');
                        }}
                      >
                        Clear selection
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDeleteMeasurement()}
                        disabled={deleteMeasurement.isPending}
                      >
                        {deleteMeasurement.isPending ? 'Deleting…' : 'Delete measurement'}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setOpenSection('tool')}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Active Tool
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                  {openSection === 'tool' ? 'Hide' : 'Show'}
                </span>
              </button>
              {openSection === 'tool' ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-neutral-900">
                    {TOOL_DEFINITIONS.find((tool) => tool.id === activeTool)?.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    {TOOL_DEFINITIONS.find((tool) => tool.id === activeTool)?.description}
                  </p>
                </>
              ) : null}
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
  measurements,
  selectedMeasurementId,
  measurementDraft,
  onMeasurementDraftChange,
  cropDraft,
  onCropDraftChange,
  onNaturalSizeChange,
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
  measurements: Measurement[];
  selectedMeasurementId: string | null;
  measurementDraft: RectDraft | null;
  onMeasurementDraftChange: (draft: RectDraft | null) => void;
  cropDraft: RectDraft | null;
  onCropDraftChange: (draft: RectDraft | null) => void;
  onNaturalSizeChange: (size: { width: number; height: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const panDragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const shapeStart = useRef<ImagePoint | null>(null);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  zoomRef.current = zoom;
  offsetRef.current = offset;
  const selectedMeasurement =
    measurements.find((candidate) => candidate.id === selectedMeasurementId) ?? null;
  const selectedMeasurementRect = selectedMeasurement
    ? measurementToRectBounds(selectedMeasurement)
    : null;

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
    onNaturalSizeChange(naturalSize);
  }, [naturalSize, onNaturalSizeChange]);

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
      setIsInteracting(true);

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
      window.clearTimeout((onWheel as typeof onWheel & { timeout?: number }).timeout);
      (onWheel as typeof onWheel & { timeout?: number }).timeout = window.setTimeout(() => {
        setIsInteracting(false);
      }, 80);
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [clampOffset, imageUrl]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageUrl || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsInteracting(true);

    if (
      activeTool === 'calibrate' ||
      activeTool === 'length' ||
      activeTool === 'rectangle' ||
      activeTool === 'crop'
    ) {
      const point = imagePointFromClient(event.clientX, event.clientY);
      if (!point) return;

      if (activeTool === 'calibrate') {
        shapeStart.current = point;
        onCalibrationDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'length') {
        shapeStart.current = point;
        onLengthLineDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'rectangle') {
        shapeStart.current = point;
        onMeasurementDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (selectedMeasurementRect) {
        const constrainedPoint = clampPointToRect(point, selectedMeasurementRect);
        shapeStart.current = constrainedPoint;
        onCropDraftChange({
          startX: constrainedPoint.x,
          startY: constrainedPoint.y,
          endX: constrainedPoint.x,
          endY: constrainedPoint.y,
        });
      }
      return;
    }

    panDragStart.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (shapeStart.current) {
      const point = imagePointFromClient(event.clientX, event.clientY, true);
      if (!point) return;

      if (activeTool === 'calibrate') {
        onCalibrationDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'length') {
        onLengthLineDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'rectangle') {
        onMeasurementDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'crop' && selectedMeasurementRect) {
        const constrainedPoint = clampPointToRect(point, selectedMeasurementRect);
        onCropDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: constrainedPoint.x,
          endY: constrainedPoint.y,
        });
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
    shapeStart.current = null;
    setIsInteracting(false);
  };

  const showReset = zoom > 1.01 || rotation !== 0 || offset.x !== 0 || offset.y !== 0;
  const draftMeasurementRect = measurementDraft ? normalizeRectDraft(measurementDraft) : null;
  const draftCropRect = cropDraft ? normalizeRectDraft(cropDraft) : null;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white/72 px-3 py-2 shadow-sm backdrop-blur">
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
        className="relative min-h-0 h-full overflow-hidden rounded-[28px] border border-black/5 bg-[#e7dfd1] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        style={{
          cursor: imageUrl
            ? activeTool === 'calibrate' ||
              activeTool === 'length' ||
              activeTool === 'rectangle' ||
              (activeTool === 'crop' && selectedMeasurementRect !== null)
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
                transition: isInteracting ? 'none' : 'transform 0.08s ease-out',
              }}
            />

            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {calibration ? (
                <LineOverlay
                  start={viewportPointFromImage({ x: calibration.startX, y: calibration.startY })}
                  end={viewportPointFromImage({ x: calibration.endX, y: calibration.endY })}
                  strokeClassName="stroke-emerald-500"
                  dotClassName="fill-emerald-500"
                />
              ) : null}

              {lengthLines.map((line) => (
                <LineOverlay
                  key={line.id}
                  start={viewportPointFromImage({ x: line.startX, y: line.startY })}
                  end={viewportPointFromImage({ x: line.endX, y: line.endY })}
                  strokeClassName={
                    line.id === selectedLengthLineId ? 'stroke-brand-700' : 'stroke-[#8b6f47]'
                  }
                  dotClassName={
                    line.id === selectedLengthLineId ? 'fill-brand-700' : 'fill-[#8b6f47]'
                  }
                  label={line.label?.trim() || undefined}
                />
              ))}

              {measurements.map((measurement) => (
                <g key={measurement.id}>
                  <RectOverlay
                    points={buildRectPolygonPoints(measurementToRectBounds(measurement)).map(
                      viewportPointFromImage,
                    )}
                    active={measurement.id === selectedMeasurementId}
                  />
                  {measurement.cropX !== null &&
                  measurement.cropY !== null &&
                  measurement.cropWidth !== null &&
                  measurement.cropHeight !== null ? (
                    <RectOverlay
                      points={buildRectPolygonPoints({
                        x: measurement.cropX,
                        y: measurement.cropY,
                        width: measurement.cropWidth,
                        height: measurement.cropHeight,
                      }).map(viewportPointFromImage)}
                      active={measurement.id === selectedMeasurementId}
                      dashed
                      fill="rgba(16, 185, 129, 0.08)"
                      stroke={measurement.id === selectedMeasurementId ? '#059669' : '#10b981'}
                      strokeWidth={measurement.id === selectedMeasurementId ? 3 : 2}
                    />
                  ) : null}
                </g>
              ))}

              {calibrationDraft ? (
                <LineOverlay
                  start={viewportPointFromImage({
                    x: calibrationDraft.startX,
                    y: calibrationDraft.startY,
                  })}
                  end={viewportPointFromImage({
                    x: calibrationDraft.endX,
                    y: calibrationDraft.endY,
                  })}
                  strokeClassName="stroke-brand-600"
                  dotClassName="fill-brand-600"
                  dashed
                />
              ) : null}

              {lengthLineDraft ? (
                <LineOverlay
                  start={viewportPointFromImage({
                    x: lengthLineDraft.startX,
                    y: lengthLineDraft.startY,
                  })}
                  end={viewportPointFromImage({ x: lengthLineDraft.endX, y: lengthLineDraft.endY })}
                  strokeClassName="stroke-[#c17a00]"
                  dotClassName="fill-[#c17a00]"
                  dashed
                  label="Draft"
                />
              ) : null}

              {draftMeasurementRect ? (
                <RectOverlay
                  points={buildRectPolygonPoints(draftMeasurementRect).map(viewportPointFromImage)}
                  active
                  dashed
                />
              ) : null}

              {draftCropRect ? (
                <RectOverlay
                  points={buildRectPolygonPoints(draftCropRect).map(viewportPointFromImage)}
                  active
                  dashed
                  fill="rgba(16, 185, 129, 0.12)"
                  stroke="#059669"
                  strokeWidth={3}
                />
              ) : null}
            </svg>

            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 backdrop-blur">
              {activeTool === 'calibrate'
                ? 'Draw calibration line • scroll to zoom • double-click to reset'
                : activeTool === 'length'
                  ? 'Draw measured line • scroll to zoom • double-click to reset'
                  : activeTool === 'rectangle'
                    ? 'Draw measured area • scroll to zoom • double-click to reset'
                    : activeTool === 'crop'
                      ? selectedMeasurementRect
                        ? 'Draw crop inside the selected measured area • scroll to zoom • double-click to reset'
                        : 'Select a measured item first • scroll to zoom • double-click to reset'
                      : 'Scroll to zoom • drag to pan • double-click to reset'}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function buildMeasurementItems(
  roomsWithItems: RoomWithItems[],
  proposalCategoriesWithItems: ProposalCategoryWithItems[],
) {
  const items: MeasurementItemRef[] = [];

  for (const room of roomsWithItems) {
    for (const item of room.items) {
      items.push({
        key: `ffe:${item.id}`,
        targetKind: 'ffe',
        targetItemId: item.id,
        targetTagSnapshot: item.itemIdTag?.trim() || item.itemName,
        primaryLabel: item.itemIdTag?.trim() || item.itemName,
        secondaryLabel: item.itemName,
        containerLabel: room.name,
      });
    }
  }

  for (const category of proposalCategoriesWithItems) {
    for (const item of category.items) {
      items.push({
        key: `proposal:${item.id}`,
        targetKind: 'proposal',
        targetItemId: item.id,
        targetTagSnapshot: item.productTag?.trim() || item.description || 'Proposal item',
        primaryLabel: item.productTag?.trim() || item.description || 'Proposal item',
        secondaryLabel: item.description || item.location || 'Proposal item',
        containerLabel: category.name,
      });
    }
  }

  return items.sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel));
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

function ToolbarIcon({ children }: { children: ReactNode }) {
  return <span className="h-5 w-5">{children}</span>;
}

function CalibrateIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 15 15 3" />
        <circle cx="4" cy="16" r="2" fill="currentColor" stroke="none" />
        <circle cx="16" cy="4" r="2" fill="currentColor" stroke="none" />
      </svg>
    </ToolbarIcon>
  );
}

function LengthLineIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 10h14" />
        <path d="M5 7v6M9 8.5v3M13 8.5v3M17 7v6" />
      </svg>
    </ToolbarIcon>
  );
}

function RectangleIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="5" width="12" height="10" rx="1.5" />
      </svg>
    </ToolbarIcon>
  );
}

function CropIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M6 3v11a2 2 0 0 0 2 2h9" />
        <path d="M3 6h11a2 2 0 0 1 2 2v9" />
      </svg>
    </ToolbarIcon>
  );
}

function PlanCanvasSkeleton() {
  return (
    <div className="grid h-full min-h-0 gap-0 bg-[#f3f1ea] xl:grid-cols-[84px_minmax(0,1fr)_380px]">
      <div className="overflow-hidden border-r border-black/5 bg-white/72 p-3">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 w-14 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
      <div className="p-6">
        <div className="h-full min-h-[70vh] animate-pulse rounded-[28px] bg-white/70" />
      </div>
      <div className="overflow-hidden border-l border-black/5 bg-white/72 p-4">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
