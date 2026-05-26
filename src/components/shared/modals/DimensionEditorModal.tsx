import { useEffect, useMemo, useState } from 'react';
import { Button, Modal } from '../../primitives';
import type { SizeMode } from '../../../types';

const fractions = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'] as const;
const metricUnits = ['mm', 'cm', 'm'] as const;
const axes = ['w', 'd', 'h'] as const;

type ImperialAxis = {
  ft: string;
  in: string;
  fraction: string;
};

type MetricAxis = {
  value: string;
};

export type DimensionDraft = {
  mode: SizeMode;
  unit: string;
  imperial: Record<(typeof axes)[number], ImperialAxis>;
  metric: Record<(typeof axes)[number], MetricAxis>;
};

const emptyDraft: DimensionDraft = {
  mode: 'imperial',
  unit: 'ft/in',
  imperial: {
    w: { ft: '', in: '', fraction: '' },
    d: { ft: '', in: '', fraction: '' },
    h: { ft: '', in: '', fraction: '' },
  },
  metric: {
    w: { value: '' },
    d: { value: '' },
    h: { value: '' },
  },
};

export type DimensionEditorInitial = Partial<{
  mode: SizeMode;
  unit: string;
  w: string;
  d: string;
  h: string;
}>;

export type DimensionEditorResult = {
  label: string;
  mode: SizeMode;
  unit: string;
  w: string;
  d: string;
  h: string;
};

type DimensionEditorBodyProps = {
  initial?: DimensionEditorInitial;
  /** Increments to force a state reset (e.g. when reopening a popover with new initial). */
  resetKey?: unknown;
  onCancel: () => void;
  onSave: (result: DimensionEditorResult) => void;
};

export function DimensionEditorBody({
  initial,
  resetKey,
  onCancel,
  onSave,
}: DimensionEditorBodyProps) {
  const [draft, setDraft] = useState<DimensionDraft>(() => fromInitial(initial));

  useEffect(() => {
    setDraft(fromInitial(initial));
    // resetKey intentionally in deps: callers use it to force a refresh when reopening.
  }, [initial, resetKey]);

  const label = useMemo(() => formatDimensionLabel(draft), [draft]);

  const save = () => {
    const values = draft.mode === 'imperial' ? imperialValues(draft) : metricValues(draft);
    onSave({
      label,
      mode: draft.mode,
      unit: draft.mode === 'imperial' ? 'ft/in' : draft.unit,
      ...values,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 rounded-sm border border-neutral-200 bg-canvas-shell p-1">
          {(['imperial', 'metric'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  mode,
                  unit: mode === 'imperial' ? 'ft/in' : 'mm',
                }))
              }
              className={`rounded px-3 py-2 text-sm font-medium ${
                draft.mode === mode ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-600'
              }`}
            >
              {mode === 'imperial' ? 'Imperial' : 'Metric'}
            </button>
          ))}
        </div>

        {draft.mode === 'imperial' ? (
          <p className="px-1 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700">Unit:</span> ft / in
          </p>
        ) : (
          <label className="grid gap-1 text-xs font-semibold text-neutral-600">
            Unit
            <select
              value={draft.unit}
              onChange={(event) =>
                setDraft((current) => ({ ...current, unit: event.target.value }))
              }
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal text-neutral-700 focus:border-brand-500 focus:outline-none"
            >
              {metricUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-3">
        {axes.map((axis) => (
          <div key={axis} className="grid gap-2 rounded-md border border-neutral-200 p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {axis.toUpperCase()}
            </span>
            {draft.mode === 'imperial' ? (
              <div className="grid grid-cols-3 gap-2">
                <NumberField
                  label="ft"
                  value={draft.imperial[axis].ft}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      imperial: {
                        ...current.imperial,
                        [axis]: { ...current.imperial[axis], ft: value },
                      },
                    }))
                  }
                />
                <NumberField
                  label="in"
                  value={draft.imperial[axis].in}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      imperial: {
                        ...current.imperial,
                        [axis]: { ...current.imperial[axis], in: value },
                      },
                    }))
                  }
                />
                <label className="grid gap-1 text-xs font-medium text-neutral-600">
                  fraction
                  <select
                    value={draft.imperial[axis].fraction}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        imperial: {
                          ...current.imperial,
                          [axis]: { ...current.imperial[axis], fraction: event.target.value },
                        },
                      }))
                    }
                    className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                  >
                    {fractions.map((fraction) => (
                      <option key={fraction || 'none'} value={fraction}>
                        {fraction || '-'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.metric[axis].value}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    metric: {
                      ...current.metric,
                      [axis]: { value: event.target.value },
                    },
                  }))
                }
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>

      <p className="rounded-sm border border-neutral-200 bg-canvas-shell px-3 py-2 text-sm font-medium text-neutral-700">
        {label || 'No dimensions set'}
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

type DimensionEditorModalProps = {
  open: boolean;
  title?: string;
  initial?: DimensionEditorInitial;
  onClose: () => void;
  onSave: (result: DimensionEditorResult) => void;
};

export function DimensionEditorModal({
  open,
  title = 'Set dimensions',
  initial,
  onClose,
  onSave,
}: DimensionEditorModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <DimensionEditorBody
        {...(initial !== undefined ? { initial } : {})}
        resetKey={open}
        onCancel={onClose}
        onSave={onSave}
      />
    </Modal>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-neutral-600">
      {label}
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm w-full focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}

function fromInitial(initial?: DimensionEditorInitial): DimensionDraft {
  const draft = structuredClone(emptyDraft);
  draft.mode = initial?.mode ?? 'imperial';
  draft.unit = initial?.unit ?? (draft.mode === 'imperial' ? 'ft/in' : 'mm');
  if (draft.mode === 'metric') {
    for (const axis of axes) draft.metric[axis].value = initial?.[axis] ?? '';
  } else {
    for (const axis of axes) draft.imperial[axis] = parseImperialAxis(initial?.[axis] ?? '');
  }
  return draft;
}

function parseImperialAxis(value: string): ImperialAxis {
  const ft = value.match(/(\d+(?:\.\d+)?)\s*'/)?.[1] ?? '';
  const inchMatch = value.match(
    /(?:^|\s)(\d+(?:\.\d+)?)?(?:\s+)?(1\/8|1\/4|3\/8|1\/2|5\/8|3\/4|7\/8)?\s*"?$/,
  );
  return {
    ft,
    in: inchMatch?.[1] ?? '',
    fraction: inchMatch?.[2] ?? '',
  };
}

function imperialValues(draft: DimensionDraft) {
  return Object.fromEntries(
    axes.map((axis) => [axis, formatImperialAxis(draft.imperial[axis])]),
  ) as {
    w: string;
    d: string;
    h: string;
  };
}

function metricValues(draft: DimensionDraft) {
  return Object.fromEntries(axes.map((axis) => [axis, draft.metric[axis].value])) as {
    w: string;
    d: string;
    h: string;
  };
}

function formatImperialAxis(axis: ImperialAxis) {
  const parts = [];
  if (axis.ft) parts.push(`${axis.ft}'`);
  const inch = [axis.in, axis.fraction].filter(Boolean).join(' ');
  if (inch) parts.push(`${inch}"`);
  return parts.join(' ');
}

function formatDimensionLabel(draft: DimensionDraft) {
  const values = draft.mode === 'imperial' ? imperialValues(draft) : metricValues(draft);
  const unit = draft.mode === 'imperial' ? '' : ` ${draft.unit}`;
  return axes
    .map((axis) => (values[axis] ? `${axis.toUpperCase()} ${values[axis]}${unit}` : ''))
    .filter(Boolean)
    .join(' x ');
}
