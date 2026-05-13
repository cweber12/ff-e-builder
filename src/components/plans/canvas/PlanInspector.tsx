import { MeasuredAreaSelect } from './MeasuredAreaSelect';
import { getPlanToolLabel } from './planToolDefinitions';
import type {
  MeasurementApplicationMode,
  MeasurementDisplay,
  MeasurementItemRef,
  PlanToolId,
} from './types';
import { Button } from '../../primitives';
import type { LengthLine, Measurement, PlanCalibration, PlanMeasurementUnit } from '../../../types';
import type { LineDraft, RectBounds } from '../../../lib/plans';
import {
  convertBaseToPlanUnits,
  formatAreaUnit,
  formatDisplayNumber,
  formatPlanLength,
} from '../../../lib/plans';

const UNIT_OPTIONS: PlanMeasurementUnit[] = ['ft', 'in', 'm', 'cm', 'mm'];

export type PlanInspectorProps = {
  activeTool: PlanToolId;
  onToolChange: (tool: PlanToolId) => void;
  calibration: PlanCalibration | null | undefined;
  calibrationLoading: boolean;
  isCalibrated: boolean;
  calibrationDraft: LineDraft | null;
  calibrationPixelLength: number | null;
  calibrationUnit: PlanMeasurementUnit;
  onCalibrationUnitChange: (unit: PlanMeasurementUnit) => void;
  calibrationFeetInput: string;
  onCalibrationFeetInputChange: (value: string) => void;
  calibrationInchesInput: string;
  onCalibrationInchesInputChange: (value: string) => void;
  calibrationLengthInput: string;
  onCalibrationLengthInputChange: (value: string) => void;
  calibrationLengthValue: number;
  canSaveCalibration: boolean;
  savingCalibration: boolean;
  onSaveCalibration: () => void;
  onClearCalibrationDraft: () => void;
  lengthLines: LengthLine[];
  lengthLinesLoading: boolean;
  selectedLengthLine: LengthLine | null;
  selectedLengthLineId: string | null;
  lengthLineDraft: LineDraft | null;
  lengthLinePixelLength: number | null;
  draftLengthInPlanUnits: number | null;
  lengthLineLabelInput: string;
  onLengthLineLabelInputChange: (value: string) => void;
  canSaveLengthLine: boolean;
  savingLengthLine: boolean;
  deletingLengthLine: boolean;
  onSaveLengthLine: () => void;
  onClearLengthLineDraft: () => void;
  onSelectLengthLine: (line: LengthLine) => void;
  onClearLengthLineSelection: () => void;
  onDeleteLengthLine: () => void;
  measurements: Measurement[];
  measurementsLoading: boolean;
  measurementItems: MeasurementItemRef[];
  measurementItemsByMeasurementId: Map<string, MeasurementItemRef>;
  normalizedMeasurementDraft: RectBounds | null;
  selectedMeasurementId: string | null;
  selectedMeasurement: Measurement | null;
  selectedMeasurementItem: MeasurementItemRef | null;
  selectedMeasurementRect: RectBounds | null;
  selectedMeasurementDisplay: MeasurementDisplay | null;
  selectedMeasurementTargetKey: string;
  onMeasurementTargetKeyChange: (value: string) => void;
  draftMeasurementWidthPlanUnits: number | null;
  draftMeasurementHeightPlanUnits: number | null;
  canSaveMeasurement: boolean;
  savingMeasurement: boolean;
  deletingMeasurement: boolean;
  onSaveMeasurement: () => void;
  onClearMeasurementDraft: () => void;
  onSelectMeasurement: (measurementId: string, item: MeasurementItemRef | null) => void;
  onClearMeasurementSelection: () => void;
  onDeleteMeasurement: () => void;
  normalizedCropDraft: RectBounds | null;
  draftCropWidthPlanUnits: number | null;
  draftCropHeightPlanUnits: number | null;
  canSaveCrop: boolean;
  canSaveCropAndPlanImage: boolean;
  canSavePlanImage: boolean;
  savingPlanImage: boolean;
  savingCrop: boolean;
  onSaveCropAndPlanImage: () => void;
  onSaveCrop: () => void;
  onClearCropDraft: () => void;
  onSavePlanImage: () => void;
  onClearSavedCrop: () => void;
  measurementApplicationMode: MeasurementApplicationMode;
  onMeasurementApplicationModeChange: (mode: MeasurementApplicationMode) => void;
  applyingMeasurement: boolean;
  onApplyMeasurement: () => void;
};

export function PlanInspector({
  activeTool,
  onToolChange,
  calibration,
  calibrationLoading,
  isCalibrated,
  calibrationDraft,
  calibrationPixelLength,
  calibrationUnit,
  onCalibrationUnitChange,
  calibrationFeetInput,
  onCalibrationFeetInputChange,
  calibrationInchesInput,
  onCalibrationInchesInputChange,
  calibrationLengthInput,
  onCalibrationLengthInputChange,
  calibrationLengthValue,
  canSaveCalibration,
  savingCalibration,
  onSaveCalibration,
  onClearCalibrationDraft,
  lengthLines,
  lengthLinesLoading,
  selectedLengthLine,
  selectedLengthLineId,
  lengthLineDraft,
  lengthLinePixelLength,
  draftLengthInPlanUnits,
  lengthLineLabelInput,
  onLengthLineLabelInputChange,
  canSaveLengthLine,
  savingLengthLine,
  deletingLengthLine,
  onSaveLengthLine,
  onClearLengthLineDraft,
  onSelectLengthLine,
  onClearLengthLineSelection,
  onDeleteLengthLine,
  measurements,
  measurementsLoading,
  measurementItems,
  measurementItemsByMeasurementId,
  normalizedMeasurementDraft,
  selectedMeasurementId,
  selectedMeasurement,
  selectedMeasurementItem,
  selectedMeasurementRect,
  selectedMeasurementDisplay,
  selectedMeasurementTargetKey,
  onMeasurementTargetKeyChange,
  draftMeasurementWidthPlanUnits,
  draftMeasurementHeightPlanUnits,
  canSaveMeasurement,
  savingMeasurement,
  deletingMeasurement,
  onSaveMeasurement,
  onClearMeasurementDraft,
  onSelectMeasurement,
  onClearMeasurementSelection,
  onDeleteMeasurement,
  normalizedCropDraft,
  draftCropWidthPlanUnits,
  draftCropHeightPlanUnits,
  canSaveCrop,
  canSaveCropAndPlanImage,
  canSavePlanImage,
  savingPlanImage,
  savingCrop,
  onSaveCropAndPlanImage,
  onSaveCrop,
  onClearCropDraft,
  onSavePlanImage,
  onClearSavedCrop,
  measurementApplicationMode,
  onMeasurementApplicationModeChange,
  applyingMeasurement,
  onApplyMeasurement,
}: PlanInspectorProps) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-black/10 bg-[#fbfaf6]/92 px-4 py-3 backdrop-blur">
      <div className="space-y-4">
        <div className="pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Inspector
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-neutral-950">
            {getPlanToolLabel(activeTool)}
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
                          onCalibrationUnitChange(event.target.value as PlanMeasurementUnit)
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
                              onChange={(event) => onCalibrationFeetInputChange(event.target.value)}
                              className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs text-neutral-500">Inches</span>
                            <input
                              type="number"
                              min="0"
                              step="0.125"
                              value={calibrationInchesInput}
                              onChange={(event) =>
                                onCalibrationInchesInputChange(event.target.value)
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
                          onChange={(event) => onCalibrationLengthInputChange(event.target.value)}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                        />
                      </label>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={onSaveCalibration}
                        disabled={!canSaveCalibration}
                      >
                        {savingCalibration ? <>Saving&hellip;</> : 'Save calibration'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClearCalibrationDraft}
                        disabled={savingCalibration}
                      >
                        Clear line
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
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
                        onChange={(event) => onLengthLineLabelInputChange(event.target.value)}
                        placeholder="Optional note"
                        className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={onSaveLengthLine}
                        disabled={!canSaveLengthLine}
                      >
                        {savingLengthLine ? (
                          <>Saving&hellip;</>
                        ) : selectedLengthLine ? (
                          'Update line'
                        ) : (
                          'Save line'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClearLengthLineDraft}
                        disabled={savingLengthLine}
                      >
                        Clear draft
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                {lengthLinesLoading ? (
                  <p className="text-sm text-neutral-500">Loading saved Length Lines&hellip;</p>
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
                        onClick={() => onSelectLengthLine(line)}
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
                    onClick={onClearLengthLineSelection}
                  >
                    Clear selection
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={onDeleteLengthLine}
                    disabled={deletingLengthLine}
                  >
                    {deletingLengthLine ? <>Deleting&hellip;</> : 'Delete line'}
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
                          onChange={(event) => onMeasurementTargetKeyChange(event.target.value)}
                          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-400"
                        >
                          <option value="">Choose an item</option>
                          {measurementItems.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.primaryLabel} - {item.secondaryLabel} - {item.containerLabel}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={onSaveMeasurement}
                          disabled={!canSaveMeasurement}
                        >
                          {savingMeasurement ? (
                            <>Saving&hellip;</>
                          ) : selectedMeasurement ? (
                            'Update measurement'
                          ) : (
                            'Save measurement'
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={onClearMeasurementDraft}
                          disabled={savingMeasurement}
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
                    onSelect={onSelectMeasurement}
                    onClear={onClearMeasurementSelection}
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
                        onClick={onSaveCropAndPlanImage}
                        disabled={!canSaveCropAndPlanImage}
                      >
                        {savingPlanImage ? <>Adding plan image&hellip;</> : 'Save crop to item'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onSaveCrop}
                        disabled={!canSaveCrop}
                      >
                        {savingCrop ? <>Saving&hellip;</> : 'Save crop only'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClearCropDraft}
                        disabled={savingCrop}
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
                        onClick={onSavePlanImage}
                        disabled={!canSavePlanImage}
                      >
                        {savingPlanImage ? <>Saving plan image&hellip;</> : 'Publish saved crop'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClearSavedCrop}
                        disabled={savingCrop}
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
                        onMeasurementApplicationModeChange(
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
                    onClick={onApplyMeasurement}
                    disabled={
                      applyingMeasurement || measurementApplicationMode === 'reference-only'
                    }
                  >
                    {applyingMeasurement ? <>Applying&hellip;</> : 'Apply to item'}
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
                    onSelect={onSelectMeasurement}
                    onClear={onClearMeasurementSelection}
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
                        onToolChange('crop');
                        onClearCropDraft();
                      }}
                    >
                      Crop plan image
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClearMeasurementSelection}
                  >
                    Clear selection
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={onDeleteMeasurement}
                    disabled={deletingMeasurement}
                  >
                    {deletingMeasurement ? <>Deleting&hellip;</> : 'Delete measurement'}
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
