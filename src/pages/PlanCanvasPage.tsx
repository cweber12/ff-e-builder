import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlanInspector } from '../components/plans/PlanInspector';
import { PlanToolRail } from '../components/plans/PlanToolRail';
import { PlanViewport } from '../components/plans/PlanViewport';
import type {
  MeasurementApplicationMode,
  MeasurementItemRef,
  PlanToolId,
} from '../components/plans/types';
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
import { ApiError } from '../lib/api/transport';
import {
  convertBaseToPlanUnits,
  convertPlanUnitsToBase,
  formatDisplayNumber,
  getLineLength,
  measurementToRectBounds,
  normalizeRectDraft,
  parseFeetAndInches,
  type LineDraft,
  type RectDraft,
} from '../lib/plans';
import { imageKeys, itemKeys, proposalKeys } from '../lib/query';
import type {
  CropParams,
  Item,
  Measurement,
  PlanMeasurementUnit,
  Project,
  ProposalCategoryWithItems,
  ProposalItem,
  RoomWithItems,
} from '../types';

type PlanCanvasPageProps = {
  project: Project;
  planId: string;
  roomsWithItems: RoomWithItems[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
};

export function PlanCanvasPage({
  project,
  planId,
  roomsWithItems,
  proposalCategoriesWithItems,
}: PlanCanvasPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useMeasuredPlans(project.id);
  const [activeTool, setActiveTool] = useState<PlanToolId>('calibrate');
  const [calibrationDraft, setCalibrationDraft] = useState<LineDraft | null>(null);
  const [calibrationLengthInput, setCalibrationLengthInput] = useState('1');
  const [calibrationUnit, setCalibrationUnit] = useState<PlanMeasurementUnit>('ft');
  const [lengthLineDraft, setLengthLineDraft] = useState<LineDraft | null>(null);
  const [selectedLengthLineId, setSelectedLengthLineId] = useState<string | null>(null);
  const [lengthLineLabelInput, setLengthLineLabelInput] = useState('');
  const [measurementDraft, setMeasurementDraft] = useState<RectDraft | null>(null);
  const [cropDraft, setCropDraft] = useState<RectDraft | null>(null);
  const [calibrationFeetInput, setCalibrationFeetInput] = useState('1');
  const [calibrationInchesInput, setCalibrationInchesInput] = useState('0');
  const [planNaturalSize, setPlanNaturalSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedMeasurementTargetKey, setSelectedMeasurementTargetKey] = useState('');
  const [measurementApplicationMode, setMeasurementApplicationMode] =
    useState<MeasurementApplicationMode>('reference-only');
  const [isApplyingMeasurement, setIsApplyingMeasurement] = useState(false);
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

  const isCalibrated = calibration != null;
  const selectedLengthLine =
    lengthLines.find((candidate) => candidate.id === selectedLengthLineId) ?? null;
  const selectedMeasurement =
    measurements.find((candidate) => candidate.id === selectedMeasurementId) ?? null;
  const selectedMeasurementItem = selectedMeasurement
    ? (measurementItemsByMeasurementId.get(selectedMeasurement.id) ?? null)
    : null;
  const selectedMeasurementDisplay = useMemo(() => {
    if (!selectedMeasurement || !calibration) return null;
    const horizontal = convertBaseToPlanUnits(
      selectedMeasurement.horizontalSpanBase,
      calibration.unit,
    );
    const vertical = convertBaseToPlanUnits(selectedMeasurement.verticalSpanBase, calibration.unit);
    const area = horizontal * vertical;

    return {
      horizontal,
      vertical,
      area,
      dimensionsText: `Measured from plan: ${formatDisplayNumber(horizontal)} ${calibration.unit} x ${formatDisplayNumber(vertical)} ${calibration.unit}`,
    };
  }, [calibration, selectedMeasurement]);

  useEffect(() => {
    if (!selectedPlan) return;
    if (!isCalibrated) {
      setActiveTool('calibrate');
    }
  }, [isCalibrated, selectedPlan]);

  useEffect(() => {
    setCalibrationDraft(null);
    setLengthLineDraft(null);
    setMeasurementDraft(null);
    setCropDraft(null);
    setPlanNaturalSize({ width: 0, height: 0 });
    setSelectedLengthLineId(null);
    setSelectedMeasurementId(null);
    setSelectedMeasurementTargetKey('');
    setMeasurementApplicationMode('reference-only');
    setLengthLineLabelInput('');
  }, [selectedPlanId]);

  useEffect(() => {
    if (!calibration) return;
    setCalibrationLengthInput(formatDisplayNumber(calibration.realWorldLength));
    setCalibrationUnit(calibration.unit);
    if (calibration.unit === 'ft') {
      const feet = Math.floor(calibration.realWorldLength);
      const inches = (calibration.realWorldLength - feet) * 12;
      setCalibrationFeetInput(String(feet));
      setCalibrationInchesInput(formatDisplayNumber(inches));
    }
  }, [calibration]);

  useEffect(() => {
    if (lengthLineDraft) return;
    setLengthLineLabelInput(selectedLengthLine?.label ?? '');
  }, [lengthLineDraft, selectedLengthLine]);

  useEffect(() => {
    if (!selectedMeasurementItem || measurementDraft) return;
    setSelectedMeasurementTargetKey(selectedMeasurementItem.key);
  }, [measurementDraft, selectedMeasurementItem]);

  useEffect(() => {
    if (!selectedMeasurement) {
      setMeasurementApplicationMode('reference-only');
      return;
    }

    setMeasurementApplicationMode(
      selectedMeasurement.targetKind === 'proposal' ? 'proposal-area' : 'ffe-dimensions',
    );
  }, [selectedMeasurement]);

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

  const calibrationLengthValue =
    calibrationUnit === 'ft'
      ? parseFeetAndInches(calibrationFeetInput, calibrationInchesInput)
      : Number(calibrationLengthInput);
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
  const canSaveCropAndPlanImage =
    canSaveCrop && planNaturalSize.width > 0 && planNaturalSize.height > 0 && !isSavingPlanImage;
  const savedCropParams =
    selectedMeasurement &&
    selectedMeasurement.cropX !== null &&
    selectedMeasurement.cropY !== null &&
    selectedMeasurement.cropWidth !== null &&
    selectedMeasurement.cropHeight !== null
      ? measurementCropToPixelCrop(
          {
            cropX: selectedMeasurement.cropX,
            cropY: selectedMeasurement.cropY,
            cropWidth: selectedMeasurement.cropWidth,
            cropHeight: selectedMeasurement.cropHeight,
          },
          planNaturalSize,
        )
      : null;
  const canSavePlanImage =
    selectedMeasurement !== null &&
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
    const measurementCrop = pixelCropToMeasurementCrop(normalizedCropDraft, planNaturalSize);
    if (!measurementCrop) return;

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
        cropX: measurementCrop.cropX,
        cropY: measurementCrop.cropY,
        cropWidth: measurementCrop.cropWidth,
        cropHeight: measurementCrop.cropHeight,
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

  const savePlanImageForMeasurement = async (measurement: Measurement, cropParams: CropParams) => {
    if (!selectedPlan || planNaturalSize.width <= 0 || planNaturalSize.height <= 0) return;

    const entityType = measurement.targetKind === 'ffe' ? 'item_plan' : 'proposal_plan';
    const existingImages = await api.images.list({
      entityType,
      entityId: measurement.targetItemId,
    });

    if (existingImages.length > 0) {
      await Promise.all(existingImages.map((image) => api.images.delete(image.id)));
    }

    const sourceBlob = await api.plans.downloadContent(project.id, selectedPlanId);
    const measurementRect = measurementToRectBounds(measurement);
    const highlightedCropBlob = await createHighlightedPlanCrop({
      sourceBlob,
      crop: cropParams,
      measurementRect,
    });
    const uploadFile = new File([highlightedCropBlob], `${selectedPlan.name}-plan.png`, {
      type: 'image/png',
    });

    const uploadedImage = await api.images.upload({
      entityType,
      entityId: measurement.targetItemId,
      file: uploadFile,
      altText: `${measurement.targetTagSnapshot} plan image`,
    });

    queryClient.setQueryData(imageKeys.forEntity(entityType, measurement.targetItemId), [
      uploadedImage,
    ]);
    restorePlanColumn(project.id, measurement.targetKind);
  };

  const handleSavePlanImage = async () => {
    if (
      !selectedMeasurement ||
      !savedCropParams ||
      !selectedPlan ||
      planNaturalSize.width <= 0 ||
      planNaturalSize.height <= 0
    ) {
      return;
    }

    setIsSavingPlanImage(true);
    try {
      await savePlanImageForMeasurement(selectedMeasurement, savedCropParams);
    } finally {
      setIsSavingPlanImage(false);
    }
  };

  const handleSaveCropAndPlanImage = async () => {
    if (!selectedMeasurement || !normalizedCropDraft) return;
    const measurementCrop = pixelCropToMeasurementCrop(normalizedCropDraft, planNaturalSize);
    if (!measurementCrop) return;

    setIsSavingPlanImage(true);
    try {
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
          cropX: measurementCrop.cropX,
          cropY: measurementCrop.cropY,
          cropWidth: measurementCrop.cropWidth,
          cropHeight: measurementCrop.cropHeight,
        },
      });

      setSelectedMeasurementId(updated.id);
      setCropDraft(null);
      await savePlanImageForMeasurement(updated, {
        cropX: normalizedCropDraft.x,
        cropY: normalizedCropDraft.y,
        cropWidth: normalizedCropDraft.width,
        cropHeight: normalizedCropDraft.height,
      });
      toast.success('Plan image added to item.');
    } finally {
      setIsSavingPlanImage(false);
    }
  };

  const handleApplyMeasurement = async () => {
    if (
      !selectedMeasurement ||
      !selectedMeasurementItem ||
      !selectedMeasurementDisplay ||
      measurementApplicationMode === 'reference-only'
    ) {
      return;
    }

    setIsApplyingMeasurement(true);
    try {
      if (selectedMeasurementItem.targetKind === 'proposal') {
        const horizontalFeet = convertBaseToPlanUnits(selectedMeasurement.horizontalSpanBase, 'ft');
        const verticalFeet = convertBaseToPlanUnits(selectedMeasurement.verticalSpanBase, 'ft');
        const quantity =
          measurementApplicationMode === 'proposal-horizontal'
            ? selectedMeasurementDisplay.horizontal
            : measurementApplicationMode === 'proposal-vertical'
              ? selectedMeasurementDisplay.vertical
              : horizontalFeet * verticalFeet;
        const quantityUnit =
          measurementApplicationMode === 'proposal-area'
            ? 'sq ft'
            : calibration?.unit === 'ft'
              ? 'ln ft'
              : calibration?.unit === 'in'
                ? 'ln in'
                : calibration?.unit === 'm'
                  ? 'ln m'
                  : calibration?.unit === 'cm'
                    ? 'ln cm'
                    : 'ln mm';
        const updated = await api.proposal.updateItem(selectedMeasurementItem.targetItemId, {
          quantity: Number(quantity.toFixed(2)),
          quantityUnit,
          version: selectedMeasurementItem.version,
        });
        queryClient.setQueryData<ProposalItem[]>(
          proposalKeys.items(selectedMeasurementItem.containerId),
          (old) => (old ?? []).map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const dimensions = selectedMeasurementDisplay.dimensionsText;
        const updated = await api.items.update(selectedMeasurementItem.targetItemId, {
          dimensions,
          version: selectedMeasurementItem.version,
        });
        queryClient.setQueryData<Item[]>(
          itemKeys.forRoom(selectedMeasurementItem.containerId),
          (old) => (old ?? []).map((item) => (item.id === updated.id ? updated : item)),
        );
      }

      toast.success('Measurement applied to item.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Measurement application failed.';
      toast.error(
        err instanceof ApiError && err.status === 409
          ? 'This item changed elsewhere. Refresh the project and try again.'
          : message,
      );
    } finally {
      setIsApplyingMeasurement(false);
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#efede6]">
      <header className="border-b border-black/10 bg-[#fbfaf6]/95 px-4 py-2.5 backdrop-blur md:px-5">
        <div className="flex min-h-10 flex-wrap items-center gap-3">
          <Link
            to={`/projects/${project.id}/plans`}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 transition hover:text-brand-700"
          >
            Plans
          </Link>
          <div className="h-5 w-px bg-neutral-200" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="max-w-[28ch] truncate font-display text-lg font-semibold text-neutral-950"
                title={selectedPlan.name}
              >
                {selectedPlan.name}
              </h1>
              <span className="rounded-full border border-neutral-200 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                {selectedPlan.sheetReference || 'No sheet ref'}
              </span>
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                  isCalibrated
                    ? 'bg-emerald-100/80 text-emerald-800'
                    : 'bg-amber-100/80 text-amber-800',
                ].join(' ')}
              >
                {isCalibrated ? 'calibrated' : 'uncalibrated'}
              </span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Sheet
            <select
              value={selectedPlan.id}
              onChange={(event) => navigate(`/projects/${project.id}/plans/${event.target.value}`)}
              className="min-w-44 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium normal-case tracking-normal text-neutral-800 outline-none transition focus:border-brand-400"
            >
              {(plans ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.sheetReference ? `${plan.sheetReference} - ${plan.name}` : plan.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[72px_minmax(0,1fr)_340px]">
        <PlanToolRail
          activeTool={activeTool}
          isCalibrated={isCalibrated}
          onToolChange={setActiveTool}
        />

        <main className="min-h-0 overflow-hidden">
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
            onMeasurementSelect={(measurementId) => {
              const item = measurementItemsByMeasurementId.get(measurementId);
              setSelectedMeasurementId(measurementId);
              setActiveTool((currentTool) => (currentTool === 'crop' ? 'crop' : 'rectangle'));
              setMeasurementDraft(null);
              setCropDraft(null);
              if (item) setSelectedMeasurementTargetKey(item.key);
            }}
            onNaturalSizeChange={setPlanNaturalSize}
          />
        </main>

        <PlanInspector
          activeTool={activeTool}
          onToolChange={setActiveTool}
          calibration={calibration}
          calibrationLoading={calibrationLoading}
          isCalibrated={isCalibrated}
          calibrationDraft={calibrationDraft}
          calibrationPixelLength={calibrationPixelLength}
          calibrationUnit={calibrationUnit}
          onCalibrationUnitChange={setCalibrationUnit}
          calibrationFeetInput={calibrationFeetInput}
          onCalibrationFeetInputChange={setCalibrationFeetInput}
          calibrationInchesInput={calibrationInchesInput}
          onCalibrationInchesInputChange={setCalibrationInchesInput}
          calibrationLengthInput={calibrationLengthInput}
          onCalibrationLengthInputChange={setCalibrationLengthInput}
          calibrationLengthValue={calibrationLengthValue}
          canSaveCalibration={canSaveCalibration}
          savingCalibration={setCalibration.isPending}
          onSaveCalibration={() => void handleSaveCalibration()}
          onClearCalibrationDraft={() => setCalibrationDraft(null)}
          lengthLines={lengthLines}
          lengthLinesLoading={lengthLinesLoading}
          selectedLengthLine={selectedLengthLine}
          selectedLengthLineId={selectedLengthLineId}
          lengthLineDraft={lengthLineDraft}
          lengthLinePixelLength={lengthLinePixelLength}
          draftLengthInPlanUnits={draftLengthInPlanUnits}
          lengthLineLabelInput={lengthLineLabelInput}
          onLengthLineLabelInputChange={setLengthLineLabelInput}
          canSaveLengthLine={canSaveLengthLine}
          savingLengthLine={createLengthLine.isPending || updateLengthLine.isPending}
          deletingLengthLine={deleteLengthLine.isPending}
          onSaveLengthLine={() => void handleSaveLengthLine()}
          onClearLengthLineDraft={() => setLengthLineDraft(null)}
          onSelectLengthLine={(line) => {
            setSelectedLengthLineId(line.id);
            setActiveTool('length');
            setLengthLineDraft(null);
            setLengthLineLabelInput(line.label ?? '');
          }}
          onClearLengthLineSelection={() => {
            setSelectedLengthLineId(null);
            setLengthLineDraft(null);
            setLengthLineLabelInput('');
          }}
          onDeleteLengthLine={() => void handleDeleteLengthLine()}
          measurements={measurements}
          measurementsLoading={measurementsLoading}
          measurementItems={measurementItems}
          measurementItemsByMeasurementId={measurementItemsByMeasurementId}
          normalizedMeasurementDraft={normalizedMeasurementDraft}
          selectedMeasurementId={selectedMeasurementId}
          selectedMeasurement={selectedMeasurement}
          selectedMeasurementItem={selectedMeasurementItem}
          selectedMeasurementRect={selectedMeasurementRect}
          selectedMeasurementDisplay={selectedMeasurementDisplay}
          selectedMeasurementTargetKey={selectedMeasurementTargetKey}
          onMeasurementTargetKeyChange={setSelectedMeasurementTargetKey}
          draftMeasurementWidthPlanUnits={draftMeasurementWidthPlanUnits}
          draftMeasurementHeightPlanUnits={draftMeasurementHeightPlanUnits}
          canSaveMeasurement={canSaveMeasurement}
          savingMeasurement={createMeasurement.isPending || updateMeasurement.isPending}
          deletingMeasurement={deleteMeasurement.isPending}
          onSaveMeasurement={() => void handleSaveMeasurement()}
          onClearMeasurementDraft={() => setMeasurementDraft(null)}
          onSelectMeasurement={(measurementId, item) => {
            setSelectedMeasurementId(measurementId);
            setMeasurementDraft(null);
            setCropDraft(null);
            if (item) setSelectedMeasurementTargetKey(item.key);
          }}
          onClearMeasurementSelection={() => {
            setSelectedMeasurementId(null);
            setMeasurementDraft(null);
            setCropDraft(null);
            setSelectedMeasurementTargetKey('');
          }}
          onDeleteMeasurement={() => void handleDeleteMeasurement()}
          normalizedCropDraft={normalizedCropDraft}
          draftCropWidthPlanUnits={draftCropWidthPlanUnits}
          draftCropHeightPlanUnits={draftCropHeightPlanUnits}
          canSaveCrop={canSaveCrop}
          canSaveCropAndPlanImage={canSaveCropAndPlanImage}
          canSavePlanImage={canSavePlanImage}
          savingPlanImage={isSavingPlanImage}
          savingCrop={updateMeasurement.isPending}
          onSaveCropAndPlanImage={() => void handleSaveCropAndPlanImage()}
          onSaveCrop={() => void handleSaveCrop()}
          onClearCropDraft={() => setCropDraft(null)}
          onSavePlanImage={() => void handleSavePlanImage()}
          onClearSavedCrop={() => void handleClearSavedCrop()}
          measurementApplicationMode={measurementApplicationMode}
          onMeasurementApplicationModeChange={setMeasurementApplicationMode}
          applyingMeasurement={isApplyingMeasurement}
          onApplyMeasurement={() => void handleApplyMeasurement()}
        />
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
        containerId: room.id,
        version: item.version,
        dimensions: item.dimensions,
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
        containerId: category.id,
        version: item.version,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
      });
    }
  }

  return items.sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel));
}

async function createHighlightedPlanCrop({
  sourceBlob,
  crop,
  measurementRect,
}: {
  sourceBlob: Blob;
  crop: CropParams;
  measurementRect: { x: number; y: number; width: number; height: number };
}) {
  const image = await loadHtmlImage(sourceBlob);
  const cropX = Math.max(0, Math.floor(crop.cropX));
  const cropY = Math.max(0, Math.floor(crop.cropY));
  const cropWidth = Math.max(1, Math.floor(crop.cropWidth));
  const cropHeight = Math.max(1, Math.floor(crop.cropHeight));

  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas export is not available in this browser.');
  }

  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const highlightX = measurementRect.x - cropX;
  const highlightY = measurementRect.y - cropY;

  context.save();
  context.fillStyle = 'rgba(201, 151, 35, 0.18)';
  context.strokeStyle = '#c99723';
  context.lineWidth = Math.max(2, Math.min(cropWidth, cropHeight) * 0.01);
  context.setLineDash([10, 8]);
  context.fillRect(highlightX, highlightY, measurementRect.width, measurementRect.height);
  context.strokeRect(highlightX, highlightY, measurementRect.width, measurementRect.height);
  context.restore();

  return await canvasToBlob(canvas);
}

async function loadHtmlImage(blob: Blob) {
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = 'async';

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not load the plan image for crop export.'));
      image.src = url;
    });

    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not create the cropped plan image.'));
      }
    }, 'image/png');
  });
}

function pixelCropToMeasurementCrop(
  crop: { x: number; y: number; width: number; height: number },
  naturalSize: { width: number; height: number },
): CropParams | null {
  if (naturalSize.width <= 0 || naturalSize.height <= 0) return null;

  return {
    cropX: crop.x / naturalSize.width,
    cropY: crop.y / naturalSize.height,
    cropWidth: crop.width / naturalSize.width,
    cropHeight: crop.height / naturalSize.height,
  };
}

function measurementCropToPixelCrop(
  crop: CropParams,
  naturalSize: { width: number; height: number },
): CropParams | null {
  if (naturalSize.width <= 0 || naturalSize.height <= 0) return null;

  return {
    cropX: crop.cropX * naturalSize.width,
    cropY: crop.cropY * naturalSize.height,
    cropWidth: crop.cropWidth * naturalSize.width,
    cropHeight: crop.cropHeight * naturalSize.height,
  };
}

function restorePlanColumn(projectId: string, targetKind: Measurement['targetKind']) {
  if (typeof window === 'undefined') return;

  const tableKey = targetKind === 'ffe' ? 'ffe' : 'proposal';
  const storageKey = `${projectId}:${tableKey}:columnConfig`;
  const planColumnId = 'plan';

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as { order?: unknown }).order) ||
      !Array.isArray((parsed as { hidden?: unknown }).hidden)
    ) {
      return;
    }

    const config = parsed as { order: string[]; hidden: string[] };
    const order = config.order.includes(planColumnId)
      ? config.order
      : insertAfterColumn(config.order, planColumnId, 'image');
    const hidden = config.hidden.filter((id) => id !== planColumnId);

    window.localStorage.setItem(storageKey, JSON.stringify({ order, hidden }));
  } catch {
    // Non-critical; the image is still saved and default columns restore on remount.
  }
}

function insertAfterColumn(order: string[], columnId: string, anchorId: string) {
  const anchorIndex = order.indexOf(anchorId);
  if (anchorIndex === -1) return [...order, columnId];

  return [...order.slice(0, anchorIndex + 1), columnId, ...order.slice(anchorIndex + 1)];
}

function PlanCanvasSkeleton() {
  return (
    <div className="grid h-full min-h-0 gap-0 bg-[#f3f1ea] xl:grid-cols-[84px_minmax(0,1fr)_380px]">
      <div className="overflow-hidden border-r border-black/5 bg-white/72 p-3">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
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
