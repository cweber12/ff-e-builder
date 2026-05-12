import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanInspector } from './PlanInspector';
import type { PlanInspectorProps } from './PlanInspector';

const calibration = {
  id: 'cal-1',
  measuredPlanId: 'plan-2',
  startX: 120,
  startY: 80,
  endX: 420,
  endY: 80,
  realWorldLength: 12,
  unit: 'ft' as const,
  pixelsPerUnit: 25,
  createdAt: '2026-05-06T00:00:00Z',
  updatedAt: '2026-05-06T00:00:00Z',
};

const measurements = [
  {
    id: 'measurement-1',
    measuredPlanId: 'plan-2',
    targetKind: 'ffe' as const,
    targetItemId: 'item-1',
    targetTagSnapshot: 'A-101',
    rectX: 100,
    rectY: 120,
    rectWidth: 240,
    rectHeight: 180,
    horizontalSpanBase: 3657.6,
    verticalSpanBase: 2743.2,
    cropX: 120,
    cropY: 140,
    cropWidth: 160,
    cropHeight: 100,
    createdAt: '2026-05-06T00:00:00Z',
    updatedAt: '2026-05-06T00:00:00Z',
  },
  {
    id: 'measurement-2',
    measuredPlanId: 'plan-2',
    targetKind: 'proposal' as const,
    targetItemId: 'proposal-item-1',
    targetTagSnapshot: 'P-42',
    rectX: 360,
    rectY: 180,
    rectWidth: 220,
    rectHeight: 160,
    horizontalSpanBase: 3352.8,
    verticalSpanBase: 2438.4,
    cropX: 390,
    cropY: 210,
    cropWidth: 140,
    cropHeight: 90,
    createdAt: '2026-05-06T00:00:00Z',
    updatedAt: '2026-05-06T00:00:00Z',
  },
];

const measurementItemsByMeasurementId = new Map([
  [
    'measurement-1',
    {
      key: 'ffe:item-1',
      targetKind: 'ffe' as const,
      targetItemId: 'item-1',
      targetTagSnapshot: 'A-101',
      primaryLabel: 'A-101',
      secondaryLabel: 'Banquette',
      containerLabel: 'Lobby',
      containerId: 'room-1',
      version: 1,
      dimensions: null,
    },
  ],
  [
    'measurement-2',
    {
      key: 'proposal:proposal-item-1',
      targetKind: 'proposal' as const,
      targetItemId: 'proposal-item-1',
      targetTagSnapshot: 'P-42',
      primaryLabel: 'P-42',
      secondaryLabel: 'Reception millwork',
      containerLabel: 'Millwork',
      containerId: 'proposal-category-1',
      version: 1,
      quantity: 1,
      quantityUnit: 'unit',
    },
  ],
]);

function buildProps(overrides: Partial<PlanInspectorProps> = {}): PlanInspectorProps {
  const selectedMeasurement = overrides.selectedMeasurement ?? null;
  const selectedMeasurementItem = selectedMeasurement
    ? (measurementItemsByMeasurementId.get(selectedMeasurement.id) ?? null)
    : null;

  return {
    activeTool: 'calibrate',
    onToolChange: vi.fn(),
    calibration,
    calibrationLoading: false,
    isCalibrated: true,
    calibrationDraft: null,
    calibrationPixelLength: null,
    calibrationUnit: 'ft',
    onCalibrationUnitChange: vi.fn(),
    calibrationFeetInput: '12',
    onCalibrationFeetInputChange: vi.fn(),
    calibrationInchesInput: '0',
    onCalibrationInchesInputChange: vi.fn(),
    calibrationLengthInput: '12',
    onCalibrationLengthInputChange: vi.fn(),
    calibrationLengthValue: 12,
    canSaveCalibration: false,
    savingCalibration: false,
    onSaveCalibration: vi.fn(),
    onClearCalibrationDraft: vi.fn(),
    lengthLines: [],
    lengthLinesLoading: false,
    selectedLengthLine: null,
    selectedLengthLineId: null,
    lengthLineDraft: null,
    lengthLinePixelLength: null,
    draftLengthInPlanUnits: null,
    lengthLineLabelInput: '',
    onLengthLineLabelInputChange: vi.fn(),
    canSaveLengthLine: false,
    savingLengthLine: false,
    deletingLengthLine: false,
    onSaveLengthLine: vi.fn(),
    onClearLengthLineDraft: vi.fn(),
    onSelectLengthLine: vi.fn(),
    onClearLengthLineSelection: vi.fn(),
    onDeleteLengthLine: vi.fn(),
    measurements,
    measurementsLoading: false,
    measurementItems: [...measurementItemsByMeasurementId.values()],
    measurementItemsByMeasurementId,
    normalizedMeasurementDraft: null,
    selectedMeasurementId: selectedMeasurement?.id ?? null,
    selectedMeasurement,
    selectedMeasurementItem,
    selectedMeasurementRect: selectedMeasurement
      ? {
          x: selectedMeasurement.rectX,
          y: selectedMeasurement.rectY,
          width: selectedMeasurement.rectWidth,
          height: selectedMeasurement.rectHeight,
        }
      : null,
    selectedMeasurementDisplay: selectedMeasurement
      ? {
          horizontal: selectedMeasurement.horizontalSpanBase / 304.8,
          vertical: selectedMeasurement.verticalSpanBase / 304.8,
          area:
            (selectedMeasurement.horizontalSpanBase / 304.8) *
            (selectedMeasurement.verticalSpanBase / 304.8),
          dimensionsText: 'Measured from plan: 12 ft x 9 ft',
        }
      : null,
    selectedMeasurementTargetKey: selectedMeasurementItem?.key ?? '',
    onMeasurementTargetKeyChange: vi.fn(),
    draftMeasurementWidthPlanUnits: null,
    draftMeasurementHeightPlanUnits: null,
    canSaveMeasurement: false,
    savingMeasurement: false,
    deletingMeasurement: false,
    onSaveMeasurement: vi.fn(),
    onClearMeasurementDraft: vi.fn(),
    onSelectMeasurement: vi.fn(),
    onClearMeasurementSelection: vi.fn(),
    onDeleteMeasurement: vi.fn(),
    normalizedCropDraft: null,
    draftCropWidthPlanUnits: null,
    draftCropHeightPlanUnits: null,
    canSaveCrop: false,
    canSaveCropAndPlanImage: false,
    canSavePlanImage: false,
    savingPlanImage: false,
    savingCrop: false,
    onSaveCropAndPlanImage: vi.fn(),
    onSaveCrop: vi.fn(),
    onClearCropDraft: vi.fn(),
    onSavePlanImage: vi.fn(),
    onClearSavedCrop: vi.fn(),
    measurementApplicationMode:
      selectedMeasurement?.targetKind === 'proposal' ? 'proposal-area' : 'ffe-dimensions',
    onMeasurementApplicationModeChange: vi.fn(),
    applyingMeasurement: false,
    onApplyMeasurement: vi.fn(),
    ...overrides,
  };
}

describe('PlanInspector', () => {
  it('shows saved calibration details for calibrated Measured Plans', () => {
    render(<PlanInspector {...buildProps()} />);

    expect(screen.getByText('Saved scale')).toBeInTheDocument();
    expect(screen.getByText(/12 ft/i)).toBeInTheDocument();
  });

  it('shows crop guidance for a selected measured FF&E item', () => {
    render(
      <PlanInspector
        {...buildProps({
          activeTool: 'crop',
          selectedMeasurement: measurements[0]!,
          canSavePlanImage: false,
        })}
      />,
    );

    expect(screen.getByText('Selected area')).toBeInTheDocument();
    expect(screen.getByText('Saved crop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish saved crop' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove saved crop' })).toBeEnabled();
  });

  it('shows proposal measurement application options for proposal crops', () => {
    const onMeasurementApplicationModeChange = vi.fn();

    render(
      <PlanInspector
        {...buildProps({
          activeTool: 'crop',
          selectedMeasurement: measurements[1]!,
          onMeasurementApplicationModeChange,
        })}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /Apply measurement/i }), {
      target: { value: 'proposal-horizontal' },
    });

    expect(screen.getByRole('option', { name: /Use area/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove saved crop' })).toBeEnabled();
    expect(onMeasurementApplicationModeChange).toHaveBeenCalledWith('proposal-horizontal');
  });
});
