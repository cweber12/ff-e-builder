import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChangeConfirmModal,
  type ChangeConfirmResult,
} from '../components/shared/modals/ChangeConfirmModal';
import { ConfirmDialog } from '../components/shared/modals/ConfirmDialog';
import {
  PlanCreateItemPanel,
  type PlanCreateItemDraft,
} from '../components/plans/canvas/PlanCreateItemPanel';
import { PlanInspector } from '../components/plans/canvas/PlanInspector';
import { PlanToolRail } from '../components/plans/canvas/PlanToolRail';
import { PlanViewport } from '../components/plans/canvas/PlanViewport';
import type {
  MeasurementApplicationMode,
  MeasurementItemRef,
  PlanToolId,
  RectangleModeId,
} from '../components/plans/canvas/types';
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
  formatAreaUnit,
  formatDisplayNumber,
  formatPlanLength,
  appendDrawingReference,
  getMeasuredPlanDrawingReference,
  getLineLength,
  measurementToRectBounds,
  normalizeRectDraft,
  parseFeetAndInches,
  type LineDraft,
  type RectBounds,
  type RectDraft,
} from '../lib/plans';
import { imageKeys, itemKeys, proposalKeys } from '../lib/query';
import type {
  CropParams,
  Item,
  Measurement,
  MeasuredPlan,
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
    useState<MeasurementApplicationMode>('proposal-area');
  const [isApplyingMeasurement, setIsApplyingMeasurement] = useState(false);
  const [isSavingPlanImage, setIsSavingPlanImage] = useState(false);
  const [rectangleMode, setRectangleMode] = useState<RectangleModeId>('measure');
  const [isSavingHighlight, setIsSavingHighlight] = useState(false);
  const [highlightRect, setHighlightRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    targetItem: MeasurementItemRef;
  } | null>(null);
  const [createItemPanelOpen, setCreateItemPanelOpen] = useState(false);
  const [createItemPreviewUrl, setCreateItemPreviewUrl] = useState<string | null>(null);
  const [createItemPreviewLoading, setCreateItemPreviewLoading] = useState(false);
  const [isCreatingItemFromMeasurement, setIsCreatingItemFromMeasurement] = useState(false);
  const [pendingMeasurementApply, setPendingMeasurementApply] = useState<{
    roundedQuantity: number;
    quantityUnit: string;
    targetItemId: string;
    containerId: string;
    version: number;
    previousQuantity: number;
    drawings: string;
  } | null>(null);
  const [showRecalibrationConfirm, setShowRecalibrationConfirm] = useState(false);
  const [pendingMeasurementReplace, setPendingMeasurementReplace] = useState<{
    targetLabel: string;
  } | null>(null);
  const [pendingSaveAndApply, setPendingSaveAndApply] = useState<ApplyMeasurementArgs | null>(null);

  const selectedPlan = useMemo(
    () => plans?.find((candidate) => candidate.id === planId) ?? null,
    [planId, plans],
  );
  const navigationPlans = useMemo(() => {
    const list = plans ?? [];
    if (!selectedPlan) return [...list].sort(comparePlansForNavigation);

    const documentSheets = list.filter(
      (candidate) =>
        selectedPlan.planDocumentId.length > 0 &&
        candidate.planDocumentId === selectedPlan.planDocumentId,
    );

    return [...(documentSheets.length > 0 ? documentSheets : list)].sort(comparePlansForNavigation);
  }, [plans, selectedPlan]);
  const selectedNavigationIndex = selectedPlan
    ? navigationPlans.findIndex((candidate) => candidate.id === selectedPlan.id)
    : -1;
  const previousPlan =
    selectedNavigationIndex > 0 ? navigationPlans[selectedNavigationIndex - 1] : null;
  const nextPlan =
    selectedNavigationIndex >= 0 && selectedNavigationIndex < navigationPlans.length - 1
      ? navigationPlans[selectedNavigationIndex + 1]
      : null;
  const documentHref =
    selectedPlan?.planDocumentId && selectedPlan.planDocumentId.length > 0
      ? `/projects/${project.id}/plans/documents/${selectedPlan.planDocumentId}`
      : `/projects/${project.id}/plans`;
  const activeDrawingReference = getMeasuredPlanDrawingReference(selectedPlan);

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
    () => buildMeasurementItems(proposalCategoriesWithItems),
    [proposalCategoriesWithItems],
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
  useEffect(() => {
    if (!selectedPlan) return;
    if (!isCalibrated) {
      setActiveTool('calibrate');
      return;
    }
    // For calibrated plans, advance the default tool past the setup stage.
    // 'calibrate' and 'crop' are setup/follow-up stages, never sensible defaults
    // once the plan is ready to measure — land on 'rectangle', the item
    // measurement tool that is the primary reason for opening a calibrated plan.
    setActiveTool((current) =>
      current === 'calibrate' || current === 'crop' ? 'rectangle' : current,
    );
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
    setMeasurementApplicationMode('proposal-area');
    setLengthLineLabelInput('');
    setCreateItemPanelOpen(false);
  }, [selectedPlanId]);

  useEffect(() => {
    return () => {
      if (createItemPreviewUrl) {
        URL.revokeObjectURL(createItemPreviewUrl);
      }
    };
  }, [createItemPreviewUrl]);

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

  // Default the apply mode to the target item's kind whenever the target changes
  // (during drafting or on selecting a saved measurement). Keyed on the target key
  // so a manual mode change is not clobbered until a different item is picked.
  useEffect(() => {
    const target =
      selectedMeasurementTargetKey.length > 0
        ? measurementItemsByKey.get(selectedMeasurementTargetKey)
        : null;
    setMeasurementApplicationMode(
      target?.targetKind === 'ffe' ? 'ffe-dimensions' : 'proposal-area',
    );
  }, [selectedMeasurementTargetKey, measurementItemsByKey]);

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
  const proposalCategoryOptions = useMemo(
    () =>
      proposalCategoriesWithItems
        .map((category) => category.name)
        .sort((a, b) => a.localeCompare(b)),
    [proposalCategoriesWithItems],
  );
  const uncategorizedCategoryName = 'Uncategorized';
  const canOpenCreateItemPanel =
    rectangleMode === 'measure' &&
    normalizedMeasurementDraft !== null &&
    draftMeasurementWidthBase !== null &&
    draftMeasurementHeightBase !== null;
  const createItemMeasurementSizeLabel =
    calibration &&
    draftMeasurementWidthPlanUnits !== null &&
    draftMeasurementHeightPlanUnits !== null
      ? `${formatPlanLength(draftMeasurementWidthPlanUnits, calibration.unit)} x ${formatPlanLength(draftMeasurementHeightPlanUnits, calibration.unit)}`
      : normalizedMeasurementDraft
        ? `${formatDisplayNumber(normalizedMeasurementDraft.width)} x ${formatDisplayNumber(normalizedMeasurementDraft.height)} px`
        : 'No measurement draft';
  const createItemMeasurementAreaLabel =
    calibration &&
    draftMeasurementWidthPlanUnits !== null &&
    draftMeasurementHeightPlanUnits !== null
      ? `${formatDisplayNumber(draftMeasurementWidthPlanUnits * draftMeasurementHeightPlanUnits)} ${formatAreaUnit(calibration.unit)}`
      : null;
  const createItemQuantityOptions =
    calibration &&
    draftMeasurementWidthPlanUnits !== null &&
    draftMeasurementHeightPlanUnits !== null
      ? [
          {
            value: 'area' as const,
            label: `Area — ${formatDisplayNumber(draftMeasurementWidthPlanUnits * draftMeasurementHeightPlanUnits)} ${formatAreaUnit(calibration.unit)}`,
          },
          {
            value: 'horizontal' as const,
            label: `Width — ${formatPlanLength(draftMeasurementWidthPlanUnits, calibration.unit)}`,
          },
          {
            value: 'vertical' as const,
            label: `Depth — ${formatPlanLength(draftMeasurementHeightPlanUnits, calibration.unit)}`,
          },
        ]
      : [];
  const createItemFootprintLabel =
    calibration &&
    draftMeasurementWidthPlanUnits !== null &&
    draftMeasurementHeightPlanUnits !== null
      ? `${formatPlanLength(draftMeasurementWidthPlanUnits, calibration.unit)} × ${formatPlanLength(draftMeasurementHeightPlanUnits, calibration.unit)}`
      : '';
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
  const savingAndApplyingMeasurement =
    createMeasurement.isPending || updateMeasurement.isPending || isApplyingMeasurement;
  const canSaveAndApplyMeasurement = canSaveMeasurement && !isApplyingMeasurement;
  const canSaveHighlight =
    highlightRect !== null && normalizedCropDraft !== null && !isSavingHighlight;
  const canSetHighlight = normalizedMeasurementDraft !== null && selectedMeasurementTarget !== null;
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

  const persistCalibration = async () => {
    if (!canSaveCalibration || !calibrationDraft || calibrationPixelLength === null) return;
    const newPixelsPerUnit = calibrationPixelLength / calibrationLengthValue;
    const unit = calibrationUnit;
    await setCalibration.mutateAsync({
      startX: calibrationDraft.startX,
      startY: calibrationDraft.startY,
      endX: calibrationDraft.endX,
      endY: calibrationDraft.endY,
      realWorldLength: calibrationLengthValue,
      unit,
      pixelsPerUnit: newPixelsPerUnit,
    });

    // Recompute dependent Measurements from their image-space geometry so their
    // measured values stay consistent with the new scale (CONTEXT.md). Crop
    // fields are preserved, so derived Plan Images are not regenerated here —
    // those refresh when each Measurement is next re-saved through the crop flow.
    for (const measurement of measurements) {
      const horizontalSpanBase = convertPlanUnitsToBase(
        measurement.rectWidth / newPixelsPerUnit,
        unit,
      );
      const verticalSpanBase = convertPlanUnitsToBase(
        measurement.rectHeight / newPixelsPerUnit,
        unit,
      );
      await updateMeasurement.mutateAsync({
        measurementId: measurement.id,
        input: {
          targetKind: measurement.targetKind,
          targetItemId: measurement.targetItemId,
          targetTagSnapshot: measurement.targetTagSnapshot,
          rectX: measurement.rectX,
          rectY: measurement.rectY,
          rectWidth: measurement.rectWidth,
          rectHeight: measurement.rectHeight,
          horizontalSpanBase,
          verticalSpanBase,
          cropX: measurement.cropX,
          cropY: measurement.cropY,
          cropWidth: measurement.cropWidth,
          cropHeight: measurement.cropHeight,
        },
      });
    }

    setCalibrationDraft(null);
  };

  const handleSaveCalibration = async () => {
    if (!canSaveCalibration) return;
    // Re-scaling a plan that already has Measurements changes every measured
    // value derived from it — confirm before doing so (CONTEXT.md).
    if (isCalibrated && measurements.length > 0) {
      setShowRecalibrationConfirm(true);
      return;
    }
    await persistCalibration();
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

  const handleOpenCreateItemPanel = () => {
    if (!canOpenCreateItemPanel || !normalizedMeasurementDraft) return;
    setCreateItemPanelOpen(true);
  };

  useEffect(() => {
    if (!createItemPanelOpen || !selectedPlan || !normalizedMeasurementDraft) {
      if (createItemPreviewUrl) {
        URL.revokeObjectURL(createItemPreviewUrl);
        setCreateItemPreviewUrl(null);
      }
      return;
    }

    let cancelled = false;

    const buildPreview = async () => {
      setCreateItemPreviewLoading(true);
      try {
        const sourceBlob = await api.plans.downloadContent(project.id, selectedPlanId);
        const previewBlob = await createHighlightedPlanCrop({
          sourceBlob,
          crop: {
            cropX: normalizedMeasurementDraft.x,
            cropY: normalizedMeasurementDraft.y,
            cropWidth: normalizedMeasurementDraft.width,
            cropHeight: normalizedMeasurementDraft.height,
          },
          measurementRect: {
            x: normalizedMeasurementDraft.x,
            y: normalizedMeasurementDraft.y,
            width: normalizedMeasurementDraft.width,
            height: normalizedMeasurementDraft.height,
          },
        });
        if (cancelled) return;

        const previewUrl = URL.createObjectURL(previewBlob);
        setCreateItemPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return previewUrl;
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to build measured item preview:', error);
          toast.error('Could not build the plan image preview. You can still save the item.');
        }
      } finally {
        if (!cancelled) setCreateItemPreviewLoading(false);
      }
    };

    void buildPreview();

    return () => {
      cancelled = true;
    };
  }, [
    createItemPanelOpen,
    createItemPreviewUrl,
    normalizedMeasurementDraft,
    project.id,
    selectedPlan,
    selectedPlanId,
  ]);

  const ensureProposalCategory = async (rawName: string) => {
    const normalizedName = rawName.trim().toLocaleLowerCase();
    const existing = proposalCategoriesWithItems.find(
      (category) => category.name.trim().toLocaleLowerCase() === normalizedName,
    );
    if (existing) return existing;

    try {
      return await api.proposal.createCategory(project.id, {
        name: rawName.trim(),
        sortOrder: proposalCategoriesWithItems.length,
      });
    } catch {
      // If another user created it first, re-fetch and reuse.
      const categories = await api.proposal.categories(project.id);
      const matched = categories.find(
        (category) => category.name.trim().toLocaleLowerCase() === normalizedName,
      );
      if (matched) return matched;
      throw new Error('Could not resolve the target Proposal Category.');
    }
  };

  const handleCreateItemFromMeasurement = async (draft: PlanCreateItemDraft) => {
    if (
      !normalizedMeasurementDraft ||
      draftMeasurementWidthBase === null ||
      draftMeasurementHeightBase === null
    ) {
      return;
    }

    setIsCreatingItemFromMeasurement(true);
    try {
      const categoryName = draft.categoryName.trim() || uncategorizedCategoryName;
      const category = await ensureProposalCategory(categoryName);

      const existingItemCount = proposalCategoriesWithItems.reduce(
        (total, proposalCategory) => total + proposalCategory.items.length,
        0,
      );
      const autoTag = `PLAN-${String(existingItemCount + 1).padStart(3, '0')}`;
      const unit = calibration?.unit ?? 'ft';

      // The measurement is applied EITHER to the item's quantity (area / one
      // measured side) OR recorded as its Footprint (W × D) — never both.
      const valueFields =
        draft.applyMode === 'footprint'
          ? {
              quantity: 1,
              quantityUnit: 'unit',
              ...buildFootprintFields(draftMeasurementWidthBase, draftMeasurementHeightBase, unit),
            }
          : computeMeasureQuantity(
              draftMeasurementWidthBase,
              draftMeasurementHeightBase,
              unit,
              draft.quantityMeasure,
            );

      const createdItem = await api.proposal.createItem(category.id, {
        productTag: draft.productTag.trim() || autoTag,
        description: draft.description.trim() || 'Measured area item',
        location: draft.location.trim(),
        drawings: appendDrawingReference('', activeDrawingReference),
        ...valueFields,
      });

      queryClient.setQueryData<ProposalItem[]>(proposalKeys.items(category.id), (old) => [
        ...(old ?? []),
        createdItem,
      ]);
      void queryClient.invalidateQueries({ queryKey: proposalKeys.categories(project.id) });
      void queryClient.invalidateQueries({ queryKey: proposalKeys.withItems(project.id) });

      const measurementCrop = pixelCropToMeasurementCrop(
        normalizedMeasurementDraft,
        planNaturalSize,
      );
      const createdMeasurement = await createMeasurement.mutateAsync({
        targetKind: 'proposal',
        targetItemId: createdItem.id,
        targetTagSnapshot: createdItem.productTag || autoTag,
        rectX: normalizedMeasurementDraft.x,
        rectY: normalizedMeasurementDraft.y,
        rectWidth: normalizedMeasurementDraft.width,
        rectHeight: normalizedMeasurementDraft.height,
        horizontalSpanBase: draftMeasurementWidthBase,
        verticalSpanBase: draftMeasurementHeightBase,
        cropX: measurementCrop?.cropX ?? null,
        cropY: measurementCrop?.cropY ?? null,
        cropWidth: measurementCrop?.cropWidth ?? null,
        cropHeight: measurementCrop?.cropHeight ?? null,
      });

      await savePlanImageForMeasurement(
        createdMeasurement,
        {
          cropX: normalizedMeasurementDraft.x,
          cropY: normalizedMeasurementDraft.y,
          cropWidth: normalizedMeasurementDraft.width,
          cropHeight: normalizedMeasurementDraft.height,
        },
        createdItem.linkedFfeItemId,
      );

      setCreateItemPanelOpen(false);
      setSelectedMeasurementId(createdMeasurement.id);
      setSelectedMeasurementTargetKey(`proposal:${createdItem.id}`);
      setMeasurementDraft(null);
      setActiveTool('rectangle');
      toast.success('Item created from measurement.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create item from measurement.';
      toast.error(message);
    } finally {
      setIsCreatingItemFromMeasurement(false);
    }
  };

  const persistMeasurement = async () => {
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
      // Remove any pre-existing measurement for the same item on this plan so
      // each item always has at most one measurement. Also purge its plan image
      // so stale highlighted crops don't linger in the image cell.
      const existing = measurements.find(
        (m) => m.targetItemId === selectedMeasurementTarget.targetItemId,
      );
      if (existing) {
        const existingEntityType = existing.targetKind === 'ffe' ? 'item_plan' : 'proposal_plan';
        const existingImages = await api.images.list({
          entityType: existingEntityType,
          entityId: existing.targetItemId,
        });
        if (existingImages.length > 0) {
          await Promise.all(existingImages.map((img) => api.images.delete(img.id)));
          queryClient.setQueryData(
            imageKeys.forEntity(existingEntityType, existing.targetItemId),
            [],
          );
        }
        await deleteMeasurement.mutateAsync(existing);
      }
      const created = await createMeasurement.mutateAsync(input);
      setSelectedMeasurementId(created.id);
    }

    setMeasurementDraft(null);
  };

  const handleSaveAndApplyMeasurement = async () => {
    if (
      !canSaveAndApplyMeasurement ||
      !normalizedMeasurementDraft ||
      !selectedMeasurementTarget ||
      draftMeasurementWidthBase === null ||
      draftMeasurementHeightBase === null ||
      draftMeasurementWidthPlanUnits === null ||
      draftMeasurementHeightPlanUnits === null
    ) {
      return;
    }

    // Capture the apply payload from the *draft* values up front: after
    // persistMeasurement() the derived selectedMeasurement* values won't reflect
    // the just-saved record within this tick.
    const applyPayload: ApplyMeasurementArgs = {
      mode: measurementApplicationMode,
      targetItem: selectedMeasurementTarget,
      widthBase: draftMeasurementWidthBase,
      heightBase: draftMeasurementHeightBase,
      widthPlanUnits: draftMeasurementWidthPlanUnits,
      heightPlanUnits: draftMeasurementHeightPlanUnits,
      unit: calibration?.unit ?? 'ft',
    };

    // Saving a new measurement for an item that already has one replaces the old
    // measurement and removes its plan image — confirm before persist + apply.
    if (!selectedMeasurementId) {
      const existing = measurements.find(
        (m) => m.targetItemId === selectedMeasurementTarget.targetItemId,
      );
      if (existing) {
        setPendingSaveAndApply(applyPayload);
        setPendingMeasurementReplace({ targetLabel: selectedMeasurementTarget.primaryLabel });
        return;
      }
    }

    await persistMeasurement();
    await applyMeasurementValue(applyPayload);
  };

  const handleSetHighlight = () => {
    if (!normalizedMeasurementDraft || !selectedMeasurementTarget) return;
    setHighlightRect({
      x: normalizedMeasurementDraft.x,
      y: normalizedMeasurementDraft.y,
      width: normalizedMeasurementDraft.width,
      height: normalizedMeasurementDraft.height,
      targetItem: selectedMeasurementTarget,
    });
    setMeasurementDraft(null);
    setSelectedMeasurementTargetKey('');
    setCropDraft(null);
    setActiveTool('crop');
  };

  const handleCancelHighlight = () => {
    setHighlightRect(null);
    setCropDraft(null);
    setActiveTool('rectangle');
  };

  const handleSaveHighlight = async () => {
    if (!highlightRect || !normalizedCropDraft) return;
    setIsSavingHighlight(true);
    try {
      const fakeMeasurement = {
        targetKind: highlightRect.targetItem.targetKind,
        targetItemId: highlightRect.targetItem.targetItemId,
        targetTagSnapshot: highlightRect.targetItem.targetTagSnapshot,
        rectX: highlightRect.x,
        rectY: highlightRect.y,
        rectWidth: highlightRect.width,
        rectHeight: highlightRect.height,
      } as unknown as Measurement;
      await savePlanImageForMeasurement(
        fakeMeasurement,
        {
          cropX: normalizedCropDraft.x,
          cropY: normalizedCropDraft.y,
          cropWidth: normalizedCropDraft.width,
          cropHeight: normalizedCropDraft.height,
        },
        highlightRect.targetItem.linkedFfeItemId,
      );
      setHighlightRect(null);
      setCropDraft(null);
      setActiveTool('rectangle');
      toast.success('Plan image saved to item.');
    } catch (error) {
      console.error('Failed to save highlight:', error);
      toast.error('Failed to save highlight image.');
    } finally {
      setIsSavingHighlight(false);
    }
  };

  const handleDeleteMeasurement = async () => {
    if (!selectedMeasurement) return;
    await deleteMeasurement.mutateAsync(selectedMeasurement);
    setSelectedMeasurementId(null);
    setMeasurementDraft(null);
    setCropDraft(null);
    setSelectedMeasurementTargetKey('');
  };

  const handleResizeMeasurement = async (measurement: Measurement, rect: RectBounds) => {
    if (!calibration) return;

    try {
      const updated = await updateMeasurement.mutateAsync({
        measurementId: measurement.id,
        input: {
          targetKind: measurement.targetKind,
          targetItemId: measurement.targetItemId,
          targetTagSnapshot: measurement.targetTagSnapshot,
          rectX: rect.x,
          rectY: rect.y,
          rectWidth: rect.width,
          rectHeight: rect.height,
          horizontalSpanBase: convertPlanUnitsToBase(
            rect.width / calibration.pixelsPerUnit,
            calibration.unit,
          ),
          verticalSpanBase: convertPlanUnitsToBase(
            rect.height / calibration.pixelsPerUnit,
            calibration.unit,
          ),
          cropX: measurement.cropX,
          cropY: measurement.cropY,
          cropWidth: measurement.cropWidth,
          cropHeight: measurement.cropHeight,
        },
      });
      setSelectedMeasurementId(updated.id);
      setMeasurementDraft(null);
      setCropDraft(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Measurement resize failed.';
      toast.error(message);
    }
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

  const savePlanImageForMeasurement = async (
    measurement: Measurement,
    cropParams: CropParams,
    linkedFfeItemId?: string | null,
  ) => {
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

    // For linked items (proposal view of an FFE item), also write item_plan so
    // the FFE table image cell stays in sync with the proposal image cell.
    if (measurement.targetKind === 'proposal' && linkedFfeItemId) {
      const existingFfeImages = await api.images.list({
        entityType: 'item_plan',
        entityId: linkedFfeItemId,
      });
      if (existingFfeImages.length > 0) {
        await Promise.all(existingFfeImages.map((img) => api.images.delete(img.id)));
      }
      const ffeUploadFile = new File([highlightedCropBlob], `${selectedPlan.name}-plan.png`, {
        type: 'image/png',
      });
      const ffeUploadedImage = await api.images.upload({
        entityType: 'item_plan',
        entityId: linkedFfeItemId,
        file: ffeUploadFile,
        altText: `${measurement.targetTagSnapshot} plan image`,
      });
      queryClient.setQueryData(imageKeys.forEntity('item_plan', linkedFfeItemId), [
        ffeUploadedImage,
      ]);
      restorePlanColumn(project.id, 'ffe');
    }
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
      await savePlanImageForMeasurement(
        selectedMeasurement,
        savedCropParams,
        selectedMeasurementItem?.linkedFfeItemId,
      );
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
      await savePlanImageForMeasurement(
        updated,
        {
          cropX: normalizedCropDraft.x,
          cropY: normalizedCropDraft.y,
          cropWidth: normalizedCropDraft.width,
          cropHeight: normalizedCropDraft.height,
        },
        selectedMeasurementItem?.linkedFfeItemId,
      );
      toast.success('Plan image added to item.');
    } finally {
      setIsSavingPlanImage(false);
    }
  };

  const executeApplyMeasurement = async (
    roundedQuantity: number,
    quantityUnit: string,
    targetItemId: string,
    containerId: string,
    version: number,
    previousQuantity: number,
    drawings: string,
    result?: ChangeConfirmResult,
  ) => {
    setIsApplyingMeasurement(true);
    try {
      const updated = await api.proposal.updateItem(targetItemId, {
        quantity: roundedQuantity,
        quantityUnit,
        drawings,
        version,
        changeLog: {
          columnKey: 'quantity',
          previousValue: String(previousQuantity),
          newValue: String(roundedQuantity),
          proposalStatus: project.proposalStatus,
          isPriceAffecting: result?.isPriceAffecting ?? true,
          ...(result?.notes ? { notes: result.notes } : {}),
        },
      });
      queryClient.setQueryData<ProposalItem[]>(proposalKeys.items(containerId), (old) =>
        (old ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
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

  const applyMeasurementValue = async ({
    mode,
    targetItem,
    widthBase,
    heightBase,
    widthPlanUnits,
    heightPlanUnits,
    unit,
  }: ApplyMeasurementArgs) => {
    // Footprint records the measured W × D on the item without touching quantity.
    // It is not a price-affecting change, so it writes directly with no changelog.
    if (targetItem.targetKind === 'proposal' && mode === 'proposal-footprint') {
      setIsApplyingMeasurement(true);
      try {
        const footprint = buildFootprintFields(widthBase, heightBase, unit);
        const drawings = appendDrawingReference(targetItem.drawings, activeDrawingReference);
        const updated = await api.proposal.updateItem(targetItem.targetItemId, {
          ...footprint,
          drawings,
          version: targetItem.version,
        });
        queryClient.setQueryData<ProposalItem[]>(
          proposalKeys.items(targetItem.containerId),
          (old) => (old ?? []).map((item) => (item.id === updated.id ? updated : item)),
        );
        toast.success('Footprint saved to item.');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Footprint update failed.';
        toast.error(
          err instanceof ApiError && err.status === 409
            ? 'This item changed elsewhere. Refresh the project and try again.'
            : message,
        );
      } finally {
        setIsApplyingMeasurement(false);
      }
      return;
    }

    if (targetItem.targetKind === 'proposal') {
      const horizontalFeet = convertBaseToPlanUnits(widthBase, 'ft');
      const verticalFeet = convertBaseToPlanUnits(heightBase, 'ft');
      const quantity =
        mode === 'proposal-horizontal'
          ? widthPlanUnits
          : mode === 'proposal-vertical'
            ? heightPlanUnits
            : horizontalFeet * verticalFeet;
      const quantityUnit =
        mode === 'proposal-area'
          ? 'sq ft'
          : unit === 'ft'
            ? 'ln ft'
            : unit === 'in'
              ? 'ln in'
              : unit === 'm'
                ? 'ln m'
                : unit === 'cm'
                  ? 'ln cm'
                  : 'ln mm';
      const roundedQuantity =
        mode === 'proposal-area' ? Math.round(quantity) : parseFloat(quantity.toFixed(2));
      const pending = {
        roundedQuantity,
        quantityUnit,
        targetItemId: targetItem.targetItemId,
        containerId: targetItem.containerId,
        version: targetItem.version,
        previousQuantity: targetItem.quantity ?? 1,
        drawings: appendDrawingReference(targetItem.drawings, activeDrawingReference),
      };
      if (project.proposalStatus !== 'in_progress') {
        setPendingMeasurementApply(pending);
        return;
      }
      await executeApplyMeasurement(
        pending.roundedQuantity,
        pending.quantityUnit,
        pending.targetItemId,
        pending.containerId,
        pending.version,
        pending.previousQuantity,
        pending.drawings,
      );
      return;
    }

    // FFE item path — proposal items are handled early-return above.
    setIsApplyingMeasurement(true);
    try {
      const dimensions = `Measured from plan: ${formatDisplayNumber(widthPlanUnits)} ${unit} x ${formatDisplayNumber(heightPlanUnits)} ${unit}`;
      const drawings = appendDrawingReference(targetItem.drawings, activeDrawingReference);
      const updated = await api.items.update(targetItem.targetItemId, {
        dimensions,
        drawings,
        version: targetItem.version,
      });
      queryClient.setQueryData<Item[]>(itemKeys.forRoom(targetItem.containerId), (old) =>
        (old ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );

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
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
        <header className="border-b border-neutral-200 bg-canvas-chrome/95 px-4 backdrop-blur md:px-5">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-neutral-200/70 py-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              <Link to={documentHref} className="transition hover:text-brand-700">
                ← Document
              </Link>
              <span aria-hidden className="h-3 w-px bg-neutral-300" />
              <span className="text-neutral-500">
                Sheet {selectedNavigationIndex + 1} of {navigationPlans.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Open previous sheet"
                disabled={!previousPlan}
                onClick={() => {
                  if (previousPlan) navigate(`/projects/${project.id}/plans/${previousPlan.id}`);
                }}
                className="icon-btn h-8 w-8 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Document sheet
                <select
                  value={selectedPlan.id}
                  onChange={(event) =>
                    navigate(`/projects/${project.id}/plans/${event.target.value}`)
                  }
                  className="min-w-44 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-sm font-medium normal-case tracking-normal text-neutral-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
                >
                  {navigationPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.sheetReference ? `${plan.sheetReference} - ${plan.name}` : plan.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                aria-label="Open next sheet"
                disabled={!nextPlan}
                onClick={() => {
                  if (nextPlan) navigate(`/projects/${project.id}/plans/${nextPlan.id}`);
                }}
                className="icon-btn h-8 w-8 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1
                  className="max-w-[40ch] truncate font-display text-xl font-semibold text-neutral-950"
                  title={selectedPlan.name}
                >
                  {selectedPlan.name}
                </h1>
                <span
                  className={[
                    'num text-[11px] font-semibold uppercase tracking-[0.14em]',
                    selectedPlan.sheetReference ? 'text-brand-700' : 'text-neutral-400',
                  ].join(' ')}
                >
                  {selectedPlan.sheetReference || 'No sheet ref'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTool('calibrate')}
              aria-label={
                isCalibrated && calibration
                  ? `Calibrated to ${formatDisplayNumber(calibration.realWorldLength)} ${calibration.unit}. Open calibration tool.`
                  : 'Calibration required. Open calibration tool.'
              }
              className={[
                'status-chip transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                isCalibrated ? 'status-chip--ok' : 'status-chip--warn',
              ].join(' ')}
            >
              {isCalibrated && calibration ? (
                <span>
                  Calibrated to{' '}
                  <span className="num normal-case tracking-normal">
                    {formatDisplayNumber(calibration.realWorldLength)} {calibration.unit}
                  </span>
                </span>
              ) : (
                <span>Calibration required</span>
              )}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[88px_minmax(0,1fr)_340px]">
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
              highlightRectOverlay={highlightRect}
              highlightCropPending={highlightRect !== null}
              onMeasurementSelect={(measurementId) => {
                const item = measurementItemsByMeasurementId.get(measurementId);
                setSelectedMeasurementId(measurementId);
                setActiveTool((currentTool) =>
                  currentTool === 'crop' || currentTool === 'select' ? currentTool : 'rectangle',
                );
                setMeasurementDraft(null);
                setCropDraft(null);
                if (item) setSelectedMeasurementTargetKey(item.key);
              }}
              onMeasurementResize={(measurement, rect) =>
                void handleResizeMeasurement(measurement, rect)
              }
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
            selectedMeasurementTargetKey={selectedMeasurementTargetKey}
            onMeasurementTargetKeyChange={setSelectedMeasurementTargetKey}
            draftMeasurementWidthPlanUnits={draftMeasurementWidthPlanUnits}
            draftMeasurementHeightPlanUnits={draftMeasurementHeightPlanUnits}
            draftTargetKind={selectedMeasurementTarget?.targetKind ?? null}
            canSaveAndApplyMeasurement={canSaveAndApplyMeasurement}
            savingMeasurement={savingAndApplyingMeasurement}
            deletingMeasurement={deleteMeasurement.isPending}
            onSaveAndApplyMeasurement={() => void handleSaveAndApplyMeasurement()}
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
            rectangleMode={rectangleMode}
            onRectangleModeChange={setRectangleMode}
            onSetHighlight={handleSetHighlight}
            canSetHighlight={canSetHighlight}
            canOpenCreateItemPanel={canOpenCreateItemPanel}
            onOpenCreateItemPanel={handleOpenCreateItemPanel}
            creatingItemFromMeasurement={isCreatingItemFromMeasurement}
            onSaveHighlight={() => void handleSaveHighlight()}
            savingHighlight={isSavingHighlight}
            canSaveHighlight={canSaveHighlight}
            highlightCropPending={highlightRect !== null}
            highlightTargetLabel={
              highlightRect
                ? `${highlightRect.targetItem.primaryLabel} – ${highlightRect.targetItem.targetTagSnapshot}`
                : null
            }
            onCancelHighlight={handleCancelHighlight}
          />
        </div>
      </div>
      {pendingMeasurementApply && (
        <ChangeConfirmModal
          columnLabel="Quantity"
          previousValue={String(pendingMeasurementApply.previousQuantity)}
          newValue={`${String(pendingMeasurementApply.roundedQuantity)} ${pendingMeasurementApply.quantityUnit}`}
          proposalStatus={project.proposalStatus}
          isPriceAffecting={true}
          lockPriceAffecting={true}
          onConfirm={(result) => {
            const p = pendingMeasurementApply;
            setPendingMeasurementApply(null);
            void executeApplyMeasurement(
              p.roundedQuantity,
              p.quantityUnit,
              p.targetItemId,
              p.containerId,
              p.version,
              p.previousQuantity,
              p.drawings,
              result,
            );
          }}
          onCancel={() => setPendingMeasurementApply(null)}
        />
      )}
      <PlanCreateItemPanel
        open={createItemPanelOpen}
        categoryOptions={proposalCategoryOptions}
        defaultCategoryName={uncategorizedCategoryName}
        measurementSizeLabel={createItemMeasurementSizeLabel}
        measurementAreaLabel={createItemMeasurementAreaLabel}
        quantityOptions={createItemQuantityOptions}
        footprintLabel={createItemFootprintLabel}
        previewUrl={createItemPreviewUrl}
        previewLoading={createItemPreviewLoading}
        submitting={isCreatingItemFromMeasurement}
        onClose={() => setCreateItemPanelOpen(false)}
        onSubmit={(draft) => void handleCreateItemFromMeasurement(draft)}
      />
      <ConfirmDialog
        open={showRecalibrationConfirm}
        title="Re-scale this plan?"
        message={
          <>
            This plan has{' '}
            <strong>
              {measurements.length} measurement{measurements.length === 1 ? '' : 's'}
            </strong>
            . Saving a new calibration re-scales every measured value derived from this plan. Saved
            plan images stay as they are until each measurement is re-cropped.
          </>
        }
        confirmLabel="Re-scale plan"
        busy={setCalibration.isPending || updateMeasurement.isPending}
        onConfirm={() => {
          setShowRecalibrationConfirm(false);
          void persistCalibration();
        }}
        onCancel={() => setShowRecalibrationConfirm(false)}
      />
      <ConfirmDialog
        open={pendingMeasurementReplace !== null}
        title="Replace existing measurement?"
        message={
          <>
            <strong>{pendingMeasurementReplace?.targetLabel}</strong> already has a measurement and
            plan image on this plan. Saving will replace the existing measurement and remove its
            current plan image.
          </>
        }
        confirmLabel="Replace measurement"
        destructive
        busy={
          createMeasurement.isPending || updateMeasurement.isPending || deleteMeasurement.isPending
        }
        onConfirm={() => {
          const payload = pendingSaveAndApply;
          setPendingMeasurementReplace(null);
          setPendingSaveAndApply(null);
          void (async () => {
            await persistMeasurement();
            if (payload) await applyMeasurementValue(payload);
          })();
        }}
        onCancel={() => {
          setPendingMeasurementReplace(null);
          setPendingSaveAndApply(null);
        }}
      />
    </>
  );
}

type ApplyMeasurementArgs = {
  mode: MeasurementApplicationMode;
  targetItem: MeasurementItemRef;
  widthBase: number;
  heightBase: number;
  widthPlanUnits: number;
  heightPlanUnits: number;
  unit: PlanMeasurementUnit;
};

type QuantityMeasure = 'area' | 'horizontal' | 'vertical';

function linearQuantityUnit(unit: PlanMeasurementUnit) {
  if (unit === 'ft') return 'ln ft';
  if (unit === 'in') return 'ln in';
  if (unit === 'm') return 'ln m';
  if (unit === 'cm') return 'ln cm';
  return 'ln mm';
}

function computeMeasureQuantity(
  widthBase: number,
  heightBase: number,
  unit: PlanMeasurementUnit,
  measure: QuantityMeasure,
) {
  const width = convertBaseToPlanUnits(widthBase, unit);
  const depth = convertBaseToPlanUnits(heightBase, unit);
  if (measure === 'area') {
    return { quantity: Math.max(1, Math.round(width * depth)), quantityUnit: formatAreaUnit(unit) };
  }
  const linear = measure === 'horizontal' ? width : depth;
  return { quantity: parseFloat(linear.toFixed(2)), quantityUnit: linearQuantityUnit(unit) };
}

function buildFootprintFields(widthBase: number, heightBase: number, unit: PlanMeasurementUnit) {
  const width = convertBaseToPlanUnits(widthBase, unit);
  const depth = convertBaseToPlanUnits(heightBase, unit);
  const area = width * depth;
  return {
    footprintW: formatDisplayNumber(width),
    footprintD: formatDisplayNumber(depth),
    footprintUnit: unit,
    footprintArea: parseFloat(area.toFixed(3)),
    footprintLabel: `${formatPlanLength(width, unit)} × ${formatPlanLength(depth, unit)} (${formatDisplayNumber(area)} ${formatAreaUnit(unit)})`,
  };
}

function buildMeasurementItems(proposalCategoriesWithItems: ProposalCategoryWithItems[]) {
  // Proposal items are the canonical, user-facing measurement targets. FF&E items
  // are reached through their linked Proposal entry, which syncs the derived Plan
  // Image (and any applied value) back to the FF&E row. See CONTEXT.md.
  const items: MeasurementItemRef[] = [];

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
        drawings: item.drawings,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        linkedFfeItemId: item.linkedFfeItemId ?? null,
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
  context.fillStyle = 'rgba(255, 230, 0, 0.42)';
  context.setLineDash([]);
  context.fillRect(highlightX, highlightY, measurementRect.width, measurementRect.height);
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

function comparePlansForNavigation(a: MeasuredPlan, b: MeasuredPlan) {
  if (
    a.planDocumentId &&
    b.planDocumentId &&
    a.planDocumentId === b.planDocumentId &&
    a.sheetIndex !== b.sheetIndex
  ) {
    return a.sheetIndex - b.sheetIndex;
  }

  if (
    a.pdfFilename &&
    b.pdfFilename &&
    a.pdfFilename === b.pdfFilename &&
    a.pdfPageNumber !== null &&
    b.pdfPageNumber !== null
  ) {
    return a.pdfPageNumber - b.pdfPageNumber;
  }

  const aSheet = a.sheetReference.trim();
  const bSheet = b.sheetReference.trim();
  if (aSheet || bSheet) {
    const sheetResult = aSheet.localeCompare(bSheet, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (sheetResult !== 0) return sheetResult;
  }

  const nameResult = a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (nameResult !== 0) return nameResult;

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function PlanCanvasSkeleton() {
  return (
    <div className="grid h-full min-h-0 gap-0 bg-canvas-shell xl:grid-cols-[88px_minmax(0,1fr)_380px]">
      <div className="overflow-hidden border-r border-neutral-100 bg-white/72 p-3">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 w-14 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
      <div className="p-6">
        <div className="h-full min-h-[70vh] animate-pulse rounded-[28px] bg-white/70" />
      </div>
      <div className="overflow-hidden border-l border-neutral-100 bg-white/72 p-4">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
