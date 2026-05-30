import { MeasuredAreaSelect } from './MeasuredAreaSelect';
import MeasurementTargetPicker from './MeasurementTargetPicker';
import { getPlanToolLabel, PLAN_TOOL_DEFINITIONS, PLAN_TOOL_GROUPS } from './planToolDefinitions';
import type { PlanToolGroupId } from './planToolDefinitions';
import type {
  MeasurementApplicationMode,
  MeasurementDisplay,
  MeasurementItemRef,
  PlanToolId,
  RectangleModeId,
} from './types';
import { Button, SegmentedControl } from '../../primitives';
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
  rectangleMode: RectangleModeId;
  onRectangleModeChange: (mode: RectangleModeId) => void;
  onSetHighlight: () => void;
  canSetHighlight: boolean;
  canOpenCreateItemPanel: boolean;
  onOpenCreateItemPanel: () => void;
  creatingItemFromMeasurement: boolean;
  onSaveHighlight: () => void;
  savingHighlight: boolean;
  canSaveHighlight: boolean;
  highlightCropPending: boolean;
  highlightTargetLabel: string | null;
  onCancelHighlight: () => void;
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
  rectangleMode,
  onRectangleModeChange,
  onSetHighlight,
  canSetHighlight,
  canOpenCreateItemPanel,
  onOpenCreateItemPanel,
  creatingItemFromMeasurement,
  onSaveHighlight,
  savingHighlight,
  canSaveHighlight,
  highlightCropPending,
  highlightTargetLabel,
  onCancelHighlight,
}: PlanInspectorProps) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-neutral-200 bg-canvas-chrome/90 px-4 py-3 backdrop-blur">
      <div className="space-y-4">
        <div className="space-y-3 border-b border-neutral-200/70 pb-3">
          <StageStrip activeTool={activeTool} />
          <div>
            <p className="eyebrow">Inspector</p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-neutral-950">
              {getPlanToolLabel(activeTool)}
              {activeTool === 'rectangle'
                ? ` · ${rectangleMode === 'highlight' ? 'Highlight' : 'Measure'}`
                : ''}
            </h2>
          </div>
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
              {!isCalibrated ? (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
                  <p className="font-semibold uppercase tracking-[0.12em]">Calibration required</p>
                  <p className="mt-1">
                    Draw a reference line on the plan and enter its real-world length. The Length,
                    Rectangle, and Crop tools stay locked until this plan is calibrated.
                  </p>
                </div>
              ) : null}
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
                        className="input-base shadow-sm"
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
                              className="input-base shadow-sm"
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
                              className="input-base shadow-sm"
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
                          className="input-base shadow-sm"
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
                        className="input-base shadow-sm"
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
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      Mode
                    </span>
                    <SegmentedControl
                      ariaLabel="Rectangle mode"
                      value={rectangleMode}
                      onChange={onRectangleModeChange}
                    >
                      <SegmentedControl.Option value="measure">Measure</SegmentedControl.Option>
                      <SegmentedControl.Option value="highlight">Highlight</SegmentedControl.Option>
                    </SegmentedControl>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      {rectangleMode === 'highlight'
                        ? 'Mark an area to bake onto the saved plan image — no measurement is saved.'
                        : 'Capture a width × height measurement and attach it to an item.'}
                    </p>
                  </div>

                  {normalizedMeasurementDraft ? (
                    <>
                      <MetricRow
                        label="Draft size"
                        value={
                          calibration &&
                          draftMeasurementWidthPlanUnits !== null &&
                          draftMeasurementHeightPlanUnits !== null
                            ? `${formatPlanLength(draftMeasurementWidthPlanUnits, calibration.unit)} × ${formatPlanLength(draftMeasurementHeightPlanUnits, calibration.unit)}`
                            : `${formatDisplayNumber(normalizedMeasurementDraft.width)} × ${formatDisplayNumber(normalizedMeasurementDraft.height)} px`
                        }
                      />
                      {calibration &&
                      draftMeasurementWidthPlanUnits !== null &&
                      draftMeasurementHeightPlanUnits !== null ? (
                        <MetricRow
                          label="Draft area"
                          value={`${formatDisplayNumber(draftMeasurementWidthPlanUnits * draftMeasurementHeightPlanUnits)} ${formatAreaUnit(calibration.unit)}`}
                        />
                      ) : null}

                      <MeasurementTargetPicker
                        items={measurementItems}
                        value={selectedMeasurementTargetKey}
                        onChange={onMeasurementTargetKeyChange}
                        measuredTargetItemIds={
                          new Set(measurements.map((measurement) => measurement.targetItemId))
                        }
                      />

                      {rectangleMode === 'measure' ? (
                        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white/80 px-3 py-2">
                          {measurementItems.length === 0 ? (
                            <p className="text-xs text-neutral-600">
                              No items yet. Create one now and include this measurement + plan
                              image.
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-600">
                              Need a new item instead? Create one directly from this measured area.
                            </p>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onOpenCreateItemPanel}
                            disabled={!canOpenCreateItemPanel || creatingItemFromMeasurement}
                          >
                            {creatingItemFromMeasurement
                              ? 'Creating item...'
                              : 'Add new item from measurement'}
                          </Button>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {rectangleMode === 'highlight' ? (
                          <>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={onSetHighlight}
                              disabled={!canSetHighlight}
                            >
                              Set crop area
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={onClearMeasurementDraft}
                            >
                              Clear draft
                            </Button>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-neutral-500">No draft area.</p>
                  )}
                </div>
              ) : null}

              {activeTool === 'crop' ? (
                <div className="mt-3 space-y-3">
                  {highlightCropPending && highlightTargetLabel ? (
                    <p className="text-sm font-medium text-neutral-700">{highlightTargetLabel}</p>
                  ) : null}

                  {!highlightCropPending && (
                    <MeasuredAreaSelect
                      measurements={measurements}
                      measurementItemsByMeasurementId={measurementItemsByMeasurementId}
                      measurementsLoading={measurementsLoading}
                      selectedMeasurementId={selectedMeasurementId}
                      onSelect={onSelectMeasurement}
                      onClear={onClearMeasurementSelection}
                    />
                  )}

                  {selectedMeasurementRect ? (
                    <>
                      <MetricRow
                        label="Selected size"
                        value={
                          calibration && selectedMeasurement
                            ? `${formatPlanLength(convertBaseToPlanUnits(selectedMeasurement.horizontalSpanBase, calibration.unit), calibration.unit)} × ${formatPlanLength(convertBaseToPlanUnits(selectedMeasurement.verticalSpanBase, calibration.unit), calibration.unit)}`
                            : `${formatDisplayNumber(selectedMeasurementRect.width)} × ${formatDisplayNumber(selectedMeasurementRect.height)} px`
                        }
                      />
                      {calibration && selectedMeasurement ? (
                        <MetricRow
                          label="Selected area"
                          value={`${formatDisplayNumber(
                            convertBaseToPlanUnits(
                              selectedMeasurement.horizontalSpanBase,
                              calibration.unit,
                            ) *
                              convertBaseToPlanUnits(
                                selectedMeasurement.verticalSpanBase,
                                calibration.unit,
                              ),
                          )} ${formatAreaUnit(calibration.unit)}`}
                        />
                      ) : null}
                    </>
                  ) : null}

                  {normalizedCropDraft ? (
                    <MetricRow
                      label="Draft crop"
                      value={
                        calibration &&
                        draftCropWidthPlanUnits !== null &&
                        draftCropHeightPlanUnits !== null
                          ? `${formatPlanLength(draftCropWidthPlanUnits, calibration.unit)} × ${formatPlanLength(draftCropHeightPlanUnits, calibration.unit)}`
                          : `${formatDisplayNumber(normalizedCropDraft.width)} × ${formatDisplayNumber(normalizedCropDraft.height)} px`
                      }
                    />
                  ) : null}

                  {selectedMeasurement &&
                  selectedMeasurement.cropWidth !== null &&
                  selectedMeasurement.cropHeight !== null ? (
                    <MetricRow
                      label="Saved crop"
                      value={`${formatDisplayNumber(selectedMeasurement.cropWidth)} × ${formatDisplayNumber(selectedMeasurement.cropHeight)} px`}
                    />
                  ) : null}

                  {normalizedCropDraft ? (
                    highlightCropPending ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={onSaveHighlight}
                          disabled={!canSaveHighlight}
                        >
                          {savingHighlight ? <>Saving&hellip;</> : 'Save highlight'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={onCancelHighlight}
                          disabled={savingHighlight}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
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
                    )
                  ) : highlightCropPending ? (
                    <div className="space-y-2">
                      <p className="text-sm text-neutral-500">Draw a crop area on the plan.</p>
                      <Button type="button" variant="ghost" size="sm" onClick={onCancelHighlight}>
                        Cancel
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

                  {selectedMeasurement ? (
                    <div className="mt-3 space-y-3">
                      <section className="rounded-xl border border-neutral-200 bg-white/80 p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="eyebrow">Measured area</span>
                          {selectedMeasurementItem ? (
                            <span className="num-muted truncate text-[11px]">
                              {selectedMeasurementItem.primaryLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-neutral-600">
                          Keep this measurement, or remove it if you want to redraw.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
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
                            {deletingMeasurement ? <>Removing&hellip;</> : 'Remove measurement'}
                          </Button>
                        </div>
                      </section>

                      {selectedMeasurementItem &&
                      selectedMeasurementDisplay &&
                      rectangleMode !== 'highlight' ? (
                        <section className="rounded-xl border border-neutral-200 bg-white/80 p-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="eyebrow">Apply measurement</span>
                            <span className="num-muted truncate text-[11px]">
                              {selectedMeasurementItem.primaryLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-neutral-600">
                            Choose how to write this measured value to the linked item.
                          </p>
                          <label className="mt-2 block">
                            <span className="sr-only">Apply measurement</span>
                            <select
                              aria-label="Apply measurement"
                              value={measurementApplicationMode}
                              onChange={(event) =>
                                onMeasurementApplicationModeChange(
                                  event.target.value as MeasurementApplicationMode,
                                )
                              }
                              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
                            >
                              {selectedMeasurementItem.targetKind === 'proposal' ? (
                                <>
                                  <option value="proposal-area">
                                    Use area ({formatDisplayNumber(selectedMeasurementDisplay.area)}{' '}
                                    {formatAreaUnit(calibration?.unit ?? 'ft')})
                                  </option>
                                  <option value="proposal-horizontal">
                                    Use horizontal (
                                    {formatDisplayNumber(selectedMeasurementDisplay.horizontal)}{' '}
                                    {calibration?.unit ?? 'ft'})
                                  </option>
                                  <option value="proposal-vertical">
                                    Use vertical (
                                    {formatDisplayNumber(selectedMeasurementDisplay.vertical)}{' '}
                                    {calibration?.unit ?? 'ft'})
                                  </option>
                                  <option value="proposal-footprint">
                                    Record as footprint (
                                    {formatPlanLength(
                                      selectedMeasurementDisplay.horizontal,
                                      calibration?.unit ?? 'ft',
                                    )}{' '}
                                    ×{' '}
                                    {formatPlanLength(
                                      selectedMeasurementDisplay.vertical,
                                      calibration?.unit ?? 'ft',
                                    )}
                                    )
                                  </option>
                                </>
                              ) : (
                                <option value="ffe-dimensions">
                                  Update dimensions ({selectedMeasurementDisplay.dimensionsText})
                                </option>
                              )}
                              <option value="reference-only">Reference only</option>
                            </select>
                          </label>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={onApplyMeasurement}
                            disabled={
                              applyingMeasurement || measurementApplicationMode === 'reference-only'
                            }
                          >
                            {applyingMeasurement ? (
                              <>&hellip;Applying</>
                            ) : (
                              'Apply measurement to item'
                            )}
                          </Button>
                        </section>
                      ) : null}

                      <section className="rounded-xl border border-neutral-200 bg-white/80 p-3">
                        <span className="eyebrow">Plan image</span>
                        <p className="mt-1 text-xs text-neutral-600">
                          Open the crop editor to frame and publish the plan image for this item.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            onToolChange('crop');
                            onClearCropDraft();
                          }}
                        >
                          Open crop editor
                        </Button>
                      </section>
                    </div>
                  ) : null}
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

        {activeTool === 'crop' &&
        selectedMeasurement &&
        selectedMeasurementItem &&
        selectedMeasurementDisplay &&
        rectangleMode !== 'highlight' ? (
          <div className="action-bar space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="eyebrow">Apply measurement</span>
              <span className="num-muted truncate text-[11px]">
                {selectedMeasurementItem.primaryLabel}
              </span>
            </div>
            <label className="block">
              <span className="sr-only">Apply measurement</span>
              <select
                aria-label="Apply measurement"
                value={measurementApplicationMode}
                onChange={(event) =>
                  onMeasurementApplicationModeChange(
                    event.target.value as MeasurementApplicationMode,
                  )
                }
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
              >
                {selectedMeasurementItem.targetKind === 'proposal' ? (
                  <>
                    <option value="proposal-area">
                      Use area - {formatDisplayNumber(selectedMeasurementDisplay.area)}{' '}
                      {formatAreaUnit(calibration?.unit ?? 'ft')}
                    </option>
                    <option value="proposal-horizontal">
                      Use horizontal - {formatDisplayNumber(selectedMeasurementDisplay.horizontal)}{' '}
                      {calibration?.unit ?? 'ft'}
                    </option>
                    <option value="proposal-vertical">
                      Use vertical - {formatDisplayNumber(selectedMeasurementDisplay.vertical)}{' '}
                      {calibration?.unit ?? 'ft'}
                    </option>
                    <option value="proposal-footprint">
                      Record as footprint -{' '}
                      {formatPlanLength(
                        selectedMeasurementDisplay.horizontal,
                        calibration?.unit ?? 'ft',
                      )}{' '}
                      ×{' '}
                      {formatPlanLength(
                        selectedMeasurementDisplay.vertical,
                        calibration?.unit ?? 'ft',
                      )}
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
              variant="primary"
              size="sm"
              className="w-full"
              onClick={onApplyMeasurement}
              disabled={applyingMeasurement || measurementApplicationMode === 'reference-only'}
            >
              {applyingMeasurement ? <>Applying&hellip;</> : 'Apply measurement to item'}
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span className="metric-row__label">{label}</span>
      <span className="metric-row__value text-right">{value}</span>
    </div>
  );
}

function StageStrip({ activeTool }: { activeTool: PlanToolId }) {
  const activeGroup = activeGroupFor(activeTool);
  const activeIndex = PLAN_TOOL_GROUPS.findIndex((group) => group.id === activeGroup);

  return (
    <ol className="flex items-center gap-2" aria-label="Workflow stage">
      {PLAN_TOOL_GROUPS.map((group, index) => {
        const isActive = group.id === activeGroup;
        const isComplete = index < activeIndex;
        return (
          <li key={group.id} className="flex items-center gap-2">
            <span
              className={[
                'stage-dot',
                isActive ? 'stage-dot--active' : isComplete ? 'stage-dot--complete' : '',
              ].join(' ')}
              aria-hidden
            />
            <span
              className={[
                'text-[10px] font-semibold uppercase tracking-[0.16em]',
                isActive
                  ? 'text-neutral-900'
                  : isComplete
                    ? 'text-neutral-500'
                    : 'text-neutral-400',
              ].join(' ')}
            >
              {group.label}
            </span>
            {index < PLAN_TOOL_GROUPS.length - 1 ? (
              <span aria-hidden className="h-px w-3 bg-neutral-300" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function activeGroupFor(toolId: PlanToolId): PlanToolGroupId {
  return PLAN_TOOL_DEFINITIONS.find((tool) => tool.id === toolId)?.group ?? 'setup';
}
