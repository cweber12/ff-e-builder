import type { Measurement } from '../../types';
import type { MeasurementItemRef } from './types';

type MeasuredAreaSelectProps = {
  measurements: Measurement[];
  measurementItemsByMeasurementId: Map<string, MeasurementItemRef>;
  measurementsLoading: boolean;
  selectedMeasurementId: string | null;
  onSelect: (measurementId: string, item: MeasurementItemRef | null) => void;
  onClear: () => void;
};

export function MeasuredAreaSelect({
  measurements,
  measurementItemsByMeasurementId,
  measurementsLoading,
  selectedMeasurementId,
  onSelect,
  onClear,
}: MeasuredAreaSelectProps) {
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
