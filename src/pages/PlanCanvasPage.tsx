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
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
import { ApiError } from '../lib/api/transport';
import {
  buildRectPolygonPoints,
  getLineLength,
  measurementToRectBounds,
  normalizeRectDraft,
  pointInRect,
  type ImagePoint,
  type LineDraft,
  type RectDraft,
} from '../lib/plans';
import { imageKeys, itemKeys, proposalKeys } from '../hooks/queryKeys';
import type {
  CropParams,
  Item,
  LengthLine,
  Measurement,
  MeasuredPlan,
  PlanCalibration,
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

type ToolId = 'calibrate' | 'length' | 'rectangle' | 'crop' | 'pan';

type MeasurementItemRef = {
  key: string;
  targetKind: Measurement['targetKind'];
  targetItemId: string;
  targetTagSnapshot: string;
  primaryLabel: string;
  secondaryLabel: string;
  containerLabel: string;
  containerId: string;
  version: number;
  dimensions?: string | null;
  quantity?: number;
  quantityUnit?: string;
};

type MeasurementApplicationMode =
  | 'reference-only'
  | 'proposal-horizontal'
  | 'proposal-vertical'
  | 'proposal-area'
  | 'ffe-dimensions';

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
  {
    id: 'pan',
    label: 'Pan',
    description: 'Drag to move around the plan at any zoom level.',
    icon: <PanIcon />,
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

export function PlanCanvasPage({
  project,
  planId,
  roomsWithItems,
  proposalCategoriesWithItems,
}: PlanCanvasPageProps) {
  const navigate = useNavigate();
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
        <aside className="overflow-y-auto border-r border-black/10 bg-[#fbfaf6]/80 p-2.5 backdrop-blur">
          <div className="flex flex-col gap-2">
            {TOOL_DEFINITIONS.map((tool) => {
              const disabled = tool.id !== 'calibrate' && tool.id !== 'pan' && !isCalibrated;
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
                    'flex h-11 w-11 items-center justify-center rounded-lg border transition',
                    active
                      ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
                      : 'border-transparent bg-transparent text-neutral-500 hover:border-neutral-200 hover:bg-white hover:text-neutral-950',
                    disabled &&
                      'cursor-not-allowed border-transparent bg-transparent text-neutral-300',
                  ].join(' ')}
                >
                  <span className="sr-only">{tool.label}</span>
                  {tool.icon}
                </button>
              );
            })}
          </div>
        </aside>

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

        <aside className="min-h-0 overflow-y-auto border-l border-black/10 bg-[#fbfaf6]/92 px-4 py-3 backdrop-blur">
          <div className="space-y-4">
            <div className="pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Inspector
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-neutral-950">
                {TOOL_DEFINITIONS.find((tool) => tool.id === activeTool)?.label ?? 'Measure'}
              </h2>
            </div>

            <section className={activeTool === 'calibrate' ? 'block' : 'hidden'}>
              <div className="flex w-full items-center justify-between gap-3 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Calibration
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  {calibrationLoading ? 'Loading' : isCalibrated ? 'Set' : 'Needed'}
                </span>
              </div>
              {activeTool === 'calibrate' ? (
                <>
                  <p className="mt-3 text-sm font-medium text-neutral-800">
                    {isCalibrated ? 'Calibrated' : 'Needs calibration'}
                  </p>

                  {calibration ? (
                    <div className="mt-3">
                      <MetricRow
                        label="Saved scale"
                        value={`${formatDisplayNumber(calibration.realWorldLength)} ${calibration.unit}`}
                      />
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatDisplayNumber(calibration.pixelsPerUnit)} px per {calibration.unit}
                      </p>
                    </div>
                  ) : null}

                  {activeTool === 'calibrate' ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm leading-6 text-neutral-500">
                        {calibrationDraft
                          ? 'Reference line captured. Enter the documented full-size length below to save or replace this plan calibration.'
                          : calibration
                            ? 'Draw a new line on the plan if you want to replace the saved calibration.'
                            : 'No reference line yet. Draw directly on the plan to start calibration.'}
                      </p>

                      {calibrationDraft ? (
                        <>
                          <MetricRow
                            label="Reference line"
                            value={`${formatDisplayNumber(calibrationPixelLength ?? 0)} px`}
                          />

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

                          {calibrationUnit === 'ft' ? (
                            <div>
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                                Real-world length
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                  <span className="mb-1 block text-xs text-neutral-500">Feet</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={calibrationFeetInput}
                                    onChange={(event) =>
                                      setCalibrationFeetInput(event.target.value)
                                    }
                                    className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs text-neutral-500">
                                    Inches
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.125"
                                    value={calibrationInchesInput}
                                    onChange={(event) =>
                                      setCalibrationInchesInput(event.target.value)
                                    }
                                    className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                                  />
                                </label>
                              </div>
                              <p className="mt-1 text-xs text-neutral-500">
                                Saved internally as{' '}
                                {Number.isFinite(calibrationLengthValue)
                                  ? formatDisplayNumber(calibrationLengthValue)
                                  : '0'}{' '}
                                ft.
                              </p>
                            </div>
                          ) : (
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
                          )}

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

            <section className={activeTool === 'length' ? 'block' : 'hidden'}>
              <div className="flex w-full items-center justify-between gap-3 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Length Lines
                </span>
                <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-500">
                    {lengthLines.length}
                  </span>
                </span>
              </div>
              {activeTool === 'length' ? (
                <>
                  {activeTool === 'length' ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm leading-6 text-neutral-500">
                        {lengthLineDraft
                          ? selectedLengthLine
                            ? 'Replacement span captured. Save to update the selected line.'
                            : 'Span captured. Save it to create a reusable Length Line.'
                          : 'Draw a span directly on the plan to capture a measured line.'}
                      </p>

                      {lengthLineDraft ? (
                        <>
                          <MetricRow
                            label="Draft span"
                            value={
                              draftLengthInPlanUnits !== null && calibration
                                ? formatPlanLength(draftLengthInPlanUnits, calibration.unit)
                                : `${formatDisplayNumber(lengthLinePixelLength ?? 0)} px`
                            }
                          />

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
                      <p className="text-sm text-neutral-500">Loading saved Length Lines…</p>
                    ) : lengthLines.length === 0 ? (
                      <p className="text-sm text-neutral-500">No saved Length Lines yet.</p>
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
                              'block w-full rounded-xl px-3 py-2 text-left transition',
                              active
                                ? 'bg-brand-50 ring-1 ring-inset ring-brand-300'
                                : 'hover:bg-neutral-50',
                            ].join(' ')}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-neutral-900">
                                  {line.label?.trim() || `Length Line ${line.id.slice(0, 4)}`}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">
                                  {displayLength !== null && calibration
                                    ? formatPlanLength(displayLength, calibration.unit)
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

            <section
              className={activeTool === 'rectangle' || activeTool === 'crop' ? 'block' : 'hidden'}
            >
              <div className="flex w-full items-center justify-between gap-3 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  {activeTool === 'crop' ? 'Crop Image' : 'Measured Items'}
                </span>
                <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-500">
                    {measurements.length}
                  </span>
                </span>
              </div>

              {activeTool === 'rectangle' || activeTool === 'crop' ? (
                <>
                  {activeTool === 'rectangle' ? (
                    <div className="mt-3 space-y-3">
                      {normalizedMeasurementDraft ? (
                        <>
                          <MetricRow
                            label="Draft area"
                            value={
                              calibration &&
                              draftMeasurementWidthPlanUnits !== null &&
                              draftMeasurementHeightPlanUnits !== null
                                ? `${formatDisplayNumber(draftMeasurementWidthPlanUnits)} ${calibration.unit} x ${formatDisplayNumber(draftMeasurementHeightPlanUnits)} ${calibration.unit}`
                                : `${formatDisplayNumber(normalizedMeasurementDraft.width)} x ${formatDisplayNumber(normalizedMeasurementDraft.height)} px`
                            }
                          />

                          <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                              Associate with item
                            </span>
                            <select
                              value={selectedMeasurementTargetKey}
                              onChange={(event) =>
                                setSelectedMeasurementTargetKey(event.target.value)
                              }
                              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-400"
                            >
                              <option value="">Choose an item</option>
                              {measurementItems.map((item) => (
                                <option key={item.key} value={item.key}>
                                  {item.primaryLabel} - {item.secondaryLabel} -{' '}
                                  {item.containerLabel}
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
                      ) : (
                        <p className="text-sm text-neutral-500">No draft area.</p>
                      )}
                    </div>
                  ) : null}

                  {activeTool === 'crop' ? (
                    <div className="mt-3 space-y-3">
                      <MeasuredAreaSelect
                        measurements={measurements}
                        measurementItemsByMeasurementId={measurementItemsByMeasurementId}
                        measurementsLoading={measurementsLoading}
                        selectedMeasurementId={selectedMeasurementId}
                        onSelect={(measurementId, item) => {
                          setSelectedMeasurementId(measurementId);
                          setMeasurementDraft(null);
                          setCropDraft(null);
                          if (item) setSelectedMeasurementTargetKey(item.key);
                        }}
                        onClear={() => {
                          setSelectedMeasurementId(null);
                          setMeasurementDraft(null);
                          setCropDraft(null);
                          setSelectedMeasurementTargetKey('');
                        }}
                      />

                      {selectedMeasurementRect ? (
                        <MetricRow
                          label="Selected area"
                          value={
                            calibration && selectedMeasurement
                              ? `${formatDisplayNumber(convertBaseToPlanUnits(selectedMeasurement.horizontalSpanBase, calibration.unit))} ${calibration.unit} x ${formatDisplayNumber(convertBaseToPlanUnits(selectedMeasurement.verticalSpanBase, calibration.unit))} ${calibration.unit}`
                              : `${formatDisplayNumber(selectedMeasurementRect.width)} x ${formatDisplayNumber(selectedMeasurementRect.height)} px`
                          }
                        />
                      ) : null}

                      {normalizedCropDraft ? (
                        <MetricRow
                          label="Draft crop"
                          value={
                            calibration &&
                            draftCropWidthPlanUnits !== null &&
                            draftCropHeightPlanUnits !== null
                              ? `${formatDisplayNumber(draftCropWidthPlanUnits)} ${calibration.unit} x ${formatDisplayNumber(draftCropHeightPlanUnits)} ${calibration.unit}`
                              : `${formatDisplayNumber(normalizedCropDraft.width)} x ${formatDisplayNumber(normalizedCropDraft.height)} px`
                          }
                        />
                      ) : null}

                      {selectedMeasurement &&
                      selectedMeasurement.cropWidth !== null &&
                      selectedMeasurement.cropHeight !== null ? (
                        <MetricRow
                          label="Saved crop"
                          value={`${formatDisplayNumber(selectedMeasurement.cropWidth)} x ${formatDisplayNumber(selectedMeasurement.cropHeight)} px`}
                        />
                      ) : null}

                      {normalizedCropDraft ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => void handleSaveCropAndPlanImage()}
                            disabled={!canSaveCropAndPlanImage}
                          >
                            {isSavingPlanImage ? 'Adding plan image…' : 'Save crop to item'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleSaveCrop()}
                            disabled={!canSaveCrop}
                          >
                            {updateMeasurement.isPending ? 'Saving…' : 'Save crop only'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCropDraft(null)}
                            disabled={updateMeasurement.isPending}
                          >
                            Clear draft
                          </Button>
                        </div>
                      ) : selectedMeasurement &&
                        selectedMeasurement.cropWidth !== null &&
                        selectedMeasurement.cropHeight !== null ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleSavePlanImage()}
                            disabled={!canSavePlanImage}
                          >
                            {isSavingPlanImage ? 'Saving plan image…' : 'Publish saved crop'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleClearSavedCrop()}
                            disabled={updateMeasurement.isPending}
                          >
                            Remove saved crop
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedMeasurement && selectedMeasurementItem && selectedMeasurementDisplay ? (
                    <div className="mt-4 border-t border-neutral-200 pt-3">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Apply measurement
                        </span>
                        <select
                          value={measurementApplicationMode}
                          onChange={(event) =>
                            setMeasurementApplicationMode(
                              event.target.value as MeasurementApplicationMode,
                            )
                          }
                          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-400"
                        >
                          {selectedMeasurementItem.targetKind === 'proposal' ? (
                            <>
                              <option value="proposal-area">
                                Use area - {formatDisplayNumber(selectedMeasurementDisplay.area)}{' '}
                                {formatAreaUnit(calibration?.unit ?? 'ft')}
                              </option>
                              <option value="proposal-horizontal">
                                Use horizontal -{' '}
                                {formatDisplayNumber(selectedMeasurementDisplay.horizontal)}{' '}
                                {calibration?.unit ?? 'ft'}
                              </option>
                              <option value="proposal-vertical">
                                Use vertical -{' '}
                                {formatDisplayNumber(selectedMeasurementDisplay.vertical)}{' '}
                                {calibration?.unit ?? 'ft'}
                              </option>
                            </>
                          ) : (
                            <option value="ffe-dimensions">
                              Update dimensions - {selectedMeasurementDisplay.dimensionsText}
                            </option>
                          )}
                          <option value="reference-only">Reference only</option>
                        </select>
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => void handleApplyMeasurement()}
                        disabled={
                          isApplyingMeasurement || measurementApplicationMode === 'reference-only'
                        }
                      >
                        {isApplyingMeasurement ? 'Applying…' : 'Apply to item'}
                      </Button>
                    </div>
                  ) : null}

                  {activeTool === 'rectangle' ? (
                    <div className="mt-4 border-t border-neutral-200 pt-3">
                      <MeasuredAreaSelect
                        measurements={measurements}
                        measurementItemsByMeasurementId={measurementItemsByMeasurementId}
                        measurementsLoading={measurementsLoading}
                        selectedMeasurementId={selectedMeasurementId}
                        onSelect={(measurementId, item) => {
                          setSelectedMeasurementId(measurementId);
                          setMeasurementDraft(null);
                          setCropDraft(null);
                          if (item) setSelectedMeasurementTargetKey(item.key);
                        }}
                        onClear={() => {
                          setSelectedMeasurementId(null);
                          setMeasurementDraft(null);
                          setCropDraft(null);
                          setSelectedMeasurementTargetKey('');
                        }}
                      />
                    </div>
                  ) : null}

                  {selectedMeasurement ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeTool === 'rectangle' ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setActiveTool('crop');
                            setCropDraft(null);
                          }}
                        >
                          Crop plan image
                        </Button>
                      ) : null}
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

            {activeTool === 'pan' ? (
              <section className="border-t border-neutral-200 pt-4">
                <div className="grid gap-3 text-sm leading-6 text-neutral-600">
                  <p>
                    Drag the plan to inspect details. Scroll to zoom and double-click the canvas to
                    reset.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    <div className="rounded-lg border border-neutral-200 bg-white/70 px-3 py-2">
                      {lengthLines.length} lines
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white/70 px-3 py-2">
                      {measurements.length} items
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-neutral-200/80 pb-2 text-sm">
      <span className="font-medium text-neutral-700">{label}</span>
      <span className="text-right text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
        {value}
      </span>
    </div>
  );
}

function MeasuredAreaSelect({
  measurements,
  measurementItemsByMeasurementId,
  measurementsLoading,
  selectedMeasurementId,
  onSelect,
  onClear,
}: {
  measurements: Measurement[];
  measurementItemsByMeasurementId: Map<string, MeasurementItemRef>;
  measurementsLoading: boolean;
  selectedMeasurementId: string | null;
  onSelect: (measurementId: string, item: MeasurementItemRef | null) => void;
  onClear: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
        Measured area
      </span>
      <select
        value={selectedMeasurementId ?? ''}
        disabled={measurementsLoading || measurements.length === 0}
        onChange={(event) => {
          const measurementId = event.target.value;
          if (!measurementId) {
            onClear();
            return;
          }
          onSelect(measurementId, measurementItemsByMeasurementId.get(measurementId) ?? null);
        }}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-400 disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        <option value="">
          {measurementsLoading
            ? 'Loading measured areas'
            : measurements.length === 0
              ? 'No measured areas'
              : 'Select an area'}
        </option>
        {measurements.map((measurement) => {
          const item = measurementItemsByMeasurementId.get(measurement.id);
          return (
            <option key={measurement.id} value={measurement.id}>
              {item
                ? `${item.primaryLabel} - ${item.secondaryLabel} - ${item.containerLabel}`
                : measurement.targetTagSnapshot}
            </option>
          );
        })}
      </select>
    </label>
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
  onMeasurementSelect,
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
  onMeasurementSelect: (measurementId: string) => void;
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
  const [crosshairPoint, setCrosshairPoint] = useState<ImagePoint | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const panDragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const pointerStart = useRef<{ clientX: number; clientY: number } | null>(null);
  const movedSincePointerDown = useRef(false);
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
  const hasDrawingCursor =
    imageUrl !== null &&
    (activeTool === 'calibrate' ||
      activeTool === 'length' ||
      activeTool === 'rectangle' ||
      (activeTool === 'crop' && selectedMeasurement !== null));

  const isInputLikeElement = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isInputLikeElement(event.target)) return;
      event.preventDefault();
      setIsSpacePressed(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setIsSpacePressed(false);
      if (activeTool !== 'pan') {
        panDragStart.current = null;
        setIsPanning(false);
      }
    };

    const onWindowBlur = () => {
      setIsSpacePressed(false);
      if (activeTool !== 'pan') {
        panDragStart.current = null;
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [activeTool, isInputLikeElement]);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    async function loadImage() {
      setLoading(true);
      setImageUrl(null);
      setNaturalSize({ width: 0, height: 0 });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setRotation(0);
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

  const updateCrosshairFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!hasDrawingCursor) {
        setCrosshairPoint(null);
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      setCrosshairPoint({
        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
      });
    },
    [hasDrawingCursor],
  );

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
    updateCrosshairFromEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsInteracting(true);
    pointerStart.current = { clientX: event.clientX, clientY: event.clientY };
    movedSincePointerDown.current = false;

    const canPan = activeTool === 'pan' || isSpacePressed;
    if (canPan) {
      panDragStart.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
      setIsPanning(true);
      return;
    }

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
      } else if (selectedMeasurement) {
        shapeStart.current = point;
        onCropDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      }
      return;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateCrosshairFromEvent(event);

    if (pointerStart.current) {
      const deltaX = event.clientX - pointerStart.current.clientX;
      const deltaY = event.clientY - pointerStart.current.clientY;
      if (Math.hypot(deltaX, deltaY) >= 3) {
        movedSincePointerDown.current = true;
      }
    }

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
      } else if (activeTool === 'crop' && selectedMeasurement) {
        onCropDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: point.x,
          endY: point.y,
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

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const shouldAttemptSelect =
      !shapeStart.current && !movedSincePointerDown.current && !isSpacePressed && imageUrl;

    if (shouldAttemptSelect) {
      const point = imagePointFromClient(event.clientX, event.clientY);
      if (point) {
        for (let index = measurements.length - 1; index >= 0; index -= 1) {
          const measurement = measurements[index];
          if (measurement && pointInRect(point, measurementToRectBounds(measurement))) {
            onMeasurementSelect(measurement.id);
            break;
          }
        }
      }
    }

    panDragStart.current = null;
    pointerStart.current = null;
    movedSincePointerDown.current = false;
    shapeStart.current = null;
    setIsInteracting(false);
    setIsPanning(false);
  };

  const handlePointerCancel = () => {
    panDragStart.current = null;
    pointerStart.current = null;
    movedSincePointerDown.current = false;
    shapeStart.current = null;
    setCrosshairPoint(null);
    setIsInteracting(false);
    setIsPanning(false);
  };

  const handlePointerLeave = () => {
    if (!pointerStart.current) setCrosshairPoint(null);
  };

  const showReset = zoom > 1.01 || rotation !== 0 || offset.x !== 0 || offset.y !== 0;
  const draftMeasurementRect = measurementDraft ? normalizeRectDraft(measurementDraft) : null;
  const draftCropRect = cropDraft ? normalizeRectDraft(cropDraft) : null;
  const liveMeasurementLabel = getLiveMeasurementLabel({
    activeTool,
    calibration,
    calibrationDraft,
    lengthLineDraft,
    measurementDraft,
    cropDraft,
  });
  const liveMeasurementPosition =
    crosshairPoint && liveMeasurementLabel
      ? {
          x: Math.max(12, Math.min(containerSize.width - 220, crosshairPoint.x + 14)),
          y: Math.max(12, Math.min(containerSize.height - 48, crosshairPoint.y + 14)),
        }
      : null;

  return (
    <div className="h-full min-h-0">
      <div
        ref={containerRef}
        className="relative h-full overflow-hidden bg-[#e3ded2]"
        style={{
          cursor: imageUrl
            ? activeTool === 'calibrate' ||
              activeTool === 'length' ||
              activeTool === 'rectangle' ||
              (activeTool === 'crop' && selectedMeasurementRect !== null)
              ? 'none'
              : activeTool === 'pan' || isSpacePressed
                ? isPanning
                  ? 'grabbing'
                  : 'grab'
                : 'default'
            : 'default',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={resetView}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0))]" />
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
                height: 'auto',
                maxWidth: 'none',
                maxHeight: 'none',
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
                  cap="tick"
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
                  cap="tick"
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

            {hasDrawingCursor && crosshairPoint ? (
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute top-0 h-full w-px bg-neutral-950/35"
                  style={{ left: crosshairPoint.x }}
                />
                <div
                  className="absolute left-0 h-px w-full bg-neutral-950/35"
                  style={{ top: crosshairPoint.y }}
                />
                {liveMeasurementPosition && liveMeasurementLabel ? (
                  <div
                    className="absolute rounded-full border border-white/60 bg-neutral-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm backdrop-blur"
                    style={{
                      left: liveMeasurementPosition.x,
                      top: liveMeasurementPosition.y,
                    }}
                  >
                    {liveMeasurementLabel}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 backdrop-blur">
              {activeTool === 'calibrate'
                ? 'Draw calibration line'
                : activeTool === 'length'
                  ? 'Draw measured line'
                  : activeTool === 'rectangle'
                    ? 'Draw measured area'
                    : activeTool === 'crop'
                      ? selectedMeasurement
                        ? 'Draw item image crop'
                        : 'Select a measured item'
                      : 'Drag to pan'}
            </div>

            <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1.5">
              <button
                type="button"
                title="Zoom in"
                onClick={() => setZoom((current) => Math.min(5, current * 1.15))}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="zoom-in" />
              </button>
              <button
                type="button"
                title="Zoom out"
                onClick={() => {
                  setZoom((current) => {
                    const nextZoom = Math.max(1, current / 1.15);
                    setOffset((currentOffset) =>
                      clampOffset(nextZoom, currentOffset.x, currentOffset.y),
                    );
                    return nextZoom;
                  });
                }}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="zoom-out" />
              </button>
              <button
                type="button"
                title="Rotate 90°"
                onClick={rotateClockwise}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="rotate" />
              </button>
              {showReset ? (
                <button
                  type="button"
                  title="Reset view"
                  onClick={resetView}
                  className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
                >
                  <ViewControlIcon type="reset" />
                </button>
              ) : null}
            </div>

            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 backdrop-blur">
              <span>{Math.round(zoom * 100)}%</span>
              {rotation !== 0 ? <span>{rotation}°</span> : null}
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

function getLiveMeasurementLabel({
  activeTool,
  calibration,
  calibrationDraft,
  lengthLineDraft,
  measurementDraft,
  cropDraft,
}: {
  activeTool: ToolId;
  calibration: PlanCalibration | null | undefined;
  calibrationDraft: LineDraft | null;
  lengthLineDraft: LineDraft | null;
  measurementDraft: RectDraft | null;
  cropDraft: RectDraft | null;
}) {
  if (activeTool === 'calibrate' && calibrationDraft) {
    return `${formatDisplayNumber(getLineLength(calibrationDraft))} px`;
  }

  if (activeTool === 'length' && lengthLineDraft) {
    const pixelLength = getLineLength(lengthLineDraft);
    if (!calibration) return `${formatDisplayNumber(pixelLength)} px`;

    return formatPlanLength(pixelLength / calibration.pixelsPerUnit, calibration.unit);
  }

  if (activeTool === 'rectangle' && measurementDraft) {
    const rect = normalizeRectDraft(measurementDraft);
    if (!calibration) {
      return `${formatDisplayNumber(rect.width)} x ${formatDisplayNumber(rect.height)} px`;
    }

    return `${formatPlanLength(rect.width / calibration.pixelsPerUnit, calibration.unit)} x ${formatPlanLength(rect.height / calibration.pixelsPerUnit, calibration.unit)}`;
  }

  if (activeTool === 'crop' && cropDraft) {
    const rect = normalizeRectDraft(cropDraft);
    if (!calibration) {
      return `${formatDisplayNumber(rect.width)} x ${formatDisplayNumber(rect.height)} px`;
    }

    return `${formatPlanLength(rect.width / calibration.pixelsPerUnit, calibration.unit)} x ${formatPlanLength(rect.height / calibration.pixelsPerUnit, calibration.unit)}`;
  }

  return null;
}

function convertPlanUnitsToBase(value: number, unit: PlanMeasurementUnit) {
  return value * MILLIMETERS_PER_UNIT[unit];
}

function convertBaseToPlanUnits(value: number, unit: PlanMeasurementUnit) {
  return value / MILLIMETERS_PER_UNIT[unit];
}

function parseFeetAndInches(feetInput: string, inchesInput: string) {
  const feet = Number(feetInput);
  const inches = Number(inchesInput);

  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return Number.NaN;
  return feet + inches / 12;
}

function formatPlanLength(value: number, unit: PlanMeasurementUnit) {
  if (unit !== 'ft') return `${formatDisplayNumber(value)} ${unit}`;
  return formatFeetAndFractionalInches(value);
}

function formatFeetAndFractionalInches(decimalFeet: number) {
  if (!Number.isFinite(decimalFeet)) return '0 in';

  const sign = decimalFeet < 0 ? '-' : '';
  const totalSixteenths = Math.round(Math.abs(decimalFeet) * 12 * 16);
  const feet = Math.floor(totalSixteenths / (12 * 16));
  const remainingSixteenths = totalSixteenths - feet * 12 * 16;
  const wholeInches = Math.floor(remainingSixteenths / 16);
  const fractionSixteenths = remainingSixteenths % 16;
  const fraction = formatInchFraction(fractionSixteenths);
  const inchParts = [
    wholeInches > 0 || feet === 0 || fraction ? String(wholeInches) : '',
    fraction,
  ].filter(Boolean);

  const feetText = feet > 0 ? `${sign}${feet} ft` : sign ? `${sign}0 ft` : '';
  const inchesText = inchParts.length > 0 ? `${inchParts.join(' ')} in` : '';

  return [feetText, inchesText].filter(Boolean).join(' ') || '0 in';
}

function formatInchFraction(sixteenths: number) {
  if (sixteenths === 0) return '';

  const divisor = greatestCommonDivisor(sixteenths, 16);
  return `${sixteenths / divisor}/${16 / divisor}`;
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }

  return left || 1;
}

function formatAreaUnit(unit: PlanMeasurementUnit) {
  if (unit === 'ft') return 'sq ft';
  if (unit === 'in') return 'sq in';
  if (unit === 'm') return 'sq m';
  if (unit === 'cm') return 'sq cm';
  return 'sq mm';
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

function PanIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10 3v14M3 10h14" strokeLinecap="round" />
        <path
          d="m8 5 2-2 2 2M15 8l2 2-2 2M12 15l-2 2-2-2M5 12l-2-2 2-2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </ToolbarIcon>
  );
}

function ViewControlIcon({ type }: { type: 'zoom-in' | 'zoom-out' | 'rotate' | 'reset' }) {
  return (
    <span className="h-4 w-4">
      {type === 'zoom-in' ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M7 5v4M5 7h4" strokeLinecap="round" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
      ) : type === 'zoom-out' ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M5 7h4" strokeLinecap="round" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
      ) : type === 'rotate' ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12.5 4a6 6 0 1 0 1.3 5" strokeLinecap="round" />
          <path d="M13.5 1.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3V1M8 15v-2M1 8H3M13 8h2" strokeLinecap="round" />
          <circle cx="8" cy="8" r="3" />
        </svg>
      )}
    </span>
  );
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
