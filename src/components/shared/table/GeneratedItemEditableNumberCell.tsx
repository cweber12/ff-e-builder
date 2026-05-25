import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { cents, dollarsToCents, formatMoney, parseUnitCostDollarsInput } from '../../../types';
import { InlineNumberEdit } from '../../primitives/InlineNumberEdit';
import { EditablePencilHint } from './EditablePencilHint';
import { useDebouncedSave } from './useDebouncedSave';

type GeneratedItemEditableNumberControlProps = {
  value: number;
  onSave: (value: number) => Promise<void> | void;
  formatter: (value: number) => string;
  parser?: (raw: string) => number | undefined;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
};

export function GeneratedItemEditableNumberControl({
  value,
  onSave,
  formatter,
  parser,
  min,
  max,
  placeholder,
  className,
  inputClassName,
  ariaLabel,
}: GeneratedItemEditableNumberControlProps) {
  return (
    <InlineNumberEdit
      value={value}
      onSave={onSave}
      formatter={formatter}
      {...(parser !== undefined ? { parser } : {})}
      {...(min !== undefined ? { min } : {})}
      {...(max !== undefined ? { max } : {})}
      {...(placeholder !== undefined ? { placeholder } : {})}
      {...(className !== undefined ? { className } : {})}
      {...(inputClassName !== undefined ? { inputClassName } : {})}
      {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
    />
  );
}

type GeneratedItemEditableNumberCellProps = {
  value: number;
  onSave: (value: number) => Promise<void> | void;
  debounceMs?: number;
  step: string;
  className?: string;
  inputClassName?: string;
  tdClassName?: string;
  indicator?: ReactNode;
};

export function GeneratedItemEditableNumberCell({
  value,
  onSave,
  debounceMs = 0,
  step,
  className,
  inputClassName,
  tdClassName,
  indicator,
}: GeneratedItemEditableNumberCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSave = useDebouncedSave(onSave, debounceMs);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    const numberValue = Number(draft);
    if (Number.isFinite(numberValue) && numberValue >= 0 && numberValue !== value) {
      if (debounceMs > 0) {
        debouncedSave.schedule(numberValue);
        await debouncedSave.flush();
      } else {
        await debouncedSave.saveNow(numberValue);
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    debouncedSave.cancel();
    setDraft(String(value));
    setEditing(false);
  };

  if (!editing) {
    return (
      <td
        className={cn('relative px-3 py-2', tdClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'block cursor-text rounded px-2 py-1 text-sm tabular-nums text-neutral-700 hover:bg-brand-50',
            className,
          )}
        >
          {value}
        </span>
        <EditablePencilHint />
      </td>
    );
  }

  return (
    <td className={cn('px-3 py-2', tdClassName)} onClick={(event) => event.stopPropagation()}>
      <input
        ref={inputRef}
        type="number"
        min="0"
        step={step}
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);

          if (debounceMs <= 0) return;

          const numberValue = Number(nextDraft);
          if (Number.isFinite(numberValue) && numberValue >= 0 && numberValue !== value) {
            debouncedSave.schedule(numberValue);
            return;
          }
          debouncedSave.cancel();
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn(inputClassName, className)}
      />
    </td>
  );
}

type GeneratedItemEditableMoneyControlProps = {
  valueCents: number;
  onSave: (valueCents: number) => Promise<void> | void;
  debounceMs?: number;
  indicator?: ReactNode;
  inputClassName?: string | undefined;
  displayClassName?: string | undefined;
  ariaLabel?: string | undefined;
};

export function GeneratedItemEditableMoneyControl({
  valueCents,
  onSave,
  debounceMs = 0,
  indicator,
  inputClassName,
  displayClassName,
  ariaLabel,
}: GeneratedItemEditableMoneyControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((valueCents / 100).toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSave = useDebouncedSave(onSave, debounceMs);

  useEffect(() => {
    if (!editing) setDraft((valueCents / 100).toString());
  }, [valueCents, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    const dollars = parseUnitCostDollarsInput(draft);
    if (dollars !== undefined) {
      const nextCents = dollarsToCents(dollars);
      if (nextCents !== valueCents) {
        if (debounceMs > 0) {
          debouncedSave.schedule(nextCents);
          await debouncedSave.flush();
        } else {
          await debouncedSave.saveNow(nextCents);
        }
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    debouncedSave.cancel();
    setDraft((valueCents / 100).toString());
    setEditing(false);
  };

  if (!editing) {
    return (
      <>
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          aria-label={ariaLabel ?? `Edit value, currently ${formatMoney(cents(valueCents))}`}
          onClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'block cursor-text rounded px-2 py-1 text-sm tabular-nums text-neutral-700 hover:bg-brand-50',
            displayClassName,
          )}
        >
          {formatMoney(cents(valueCents))}
        </span>
      </>
    );
  }

  return (
    <div className="relative w-28">
      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-neutral-400">
        $
      </span>
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="0.01"
        value={draft}
        aria-label={ariaLabel}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);

          if (debounceMs <= 0) return;

          const dollars = parseUnitCostDollarsInput(nextDraft);
          if (dollars === undefined) {
            debouncedSave.cancel();
            return;
          }
          const nextCents = dollarsToCents(dollars);
          if (nextCents === valueCents) {
            debouncedSave.cancel();
            return;
          }
          debouncedSave.schedule(nextCents);
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn('w-full py-1 pl-5 pr-2', inputClassName)}
      />
    </div>
  );
}

type GeneratedItemEditableMoneyCellProps = {
  valueCents: number;
  onSave: (valueCents: number) => Promise<void> | void;
  debounceMs?: number;
  indicator?: ReactNode;
  tdClassName?: string;
  inputClassName?: string;
};

export function GeneratedItemEditableMoneyCell({
  valueCents,
  onSave,
  debounceMs = 0,
  indicator,
  tdClassName,
  inputClassName,
}: GeneratedItemEditableMoneyCellProps) {
  return (
    <td
      className={cn('relative px-3 py-2', tdClassName)}
      onClick={(event) => event.stopPropagation()}
    >
      <GeneratedItemEditableMoneyControl
        valueCents={valueCents}
        onSave={onSave}
        debounceMs={debounceMs}
        indicator={indicator}
        inputClassName={inputClassName}
      />
      <EditablePencilHint />
    </td>
  );
}

type GeneratedItemEditableQuantityControlProps = {
  quantity: number;
  quantityUnit: string;
  quantityUnits: readonly string[];
  onSaveQuantity: (value: number) => Promise<void> | void;
  onSaveUnit: (value: string) => Promise<void> | void;
  debounceMs?: number;
  indicator?: ReactNode;
  inputClassName?: string | undefined;
  displayClassName?: string | undefined;
};

export function GeneratedItemEditableQuantityControl({
  quantity,
  quantityUnit,
  quantityUnits,
  onSaveQuantity,
  onSaveUnit,
  debounceMs = 0,
  indicator,
  inputClassName,
  displayClassName,
}: GeneratedItemEditableQuantityControlProps) {
  const [editing, setEditing] = useState(false);
  const debouncedQuantitySave = useDebouncedSave(onSaveQuantity, debounceMs);

  const saveQuantity = (rawValue: string) => {
    const value = Number(rawValue);
    if (Number.isFinite(value) && value >= 0) {
      if (debounceMs > 0) {
        debouncedQuantitySave.schedule(value);
      } else {
        void debouncedQuantitySave.saveNow(value);
      }
      return;
    }
    debouncedQuantitySave.cancel();
  };

  if (!editing) {
    return (
      <>
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          aria-label={`Edit quantity, currently ${quantity} ${quantityUnit}`}
          onClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'block cursor-text rounded px-2 py-1 text-sm tabular-nums text-neutral-700 hover:bg-brand-50',
            displayClassName,
          )}
        >
          {quantity} {quantityUnit}
        </span>
      </>
    );
  }

  return (
    <div
      className="flex flex-col gap-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          if (debounceMs > 0 && debouncedQuantitySave.hasPending()) {
            void debouncedQuantitySave.flush();
          }
          setEditing(false);
        }
      }}
    >
      <input
        type="number"
        min="0"
        step="0.01"
        defaultValue={quantity}
        autoFocus
        onChange={(event) => saveQuantity(event.target.value)}
        className={cn('w-20', inputClassName)}
        aria-label="Quantity"
      />
      <select
        value={quantityUnit}
        onChange={(event) => void onSaveUnit(event.target.value)}
        className={cn('w-20', inputClassName)}
        aria-label="Quantity unit"
      >
        {quantityUnits.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
    </div>
  );
}

type GeneratedItemEditableQuantityCellProps = {
  quantity: number;
  quantityUnit: string;
  quantityUnits: readonly string[];
  onSaveQuantity: (value: number) => Promise<void> | void;
  onSaveUnit: (value: string) => Promise<void> | void;
  debounceMs?: number;
  indicator?: ReactNode;
  tdClassName?: string;
  inputClassName?: string;
};

export function GeneratedItemEditableQuantityCell({
  quantity,
  quantityUnit,
  quantityUnits,
  onSaveQuantity,
  onSaveUnit,
  debounceMs = 0,
  indicator,
  tdClassName,
  inputClassName,
}: GeneratedItemEditableQuantityCellProps) {
  return (
    <td
      className={cn('relative px-3 py-2', tdClassName)}
      onClick={(event) => event.stopPropagation()}
    >
      <GeneratedItemEditableQuantityControl
        quantity={quantity}
        quantityUnit={quantityUnit}
        quantityUnits={quantityUnits}
        onSaveQuantity={onSaveQuantity}
        onSaveUnit={onSaveUnit}
        debounceMs={debounceMs}
        indicator={indicator}
        inputClassName={inputClassName}
      />
      <EditablePencilHint />
    </td>
  );
}
