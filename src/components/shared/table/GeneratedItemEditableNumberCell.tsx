import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { cents, dollarsToCents, formatMoney, parseUnitCostDollarsInput } from '../../../types';
import { InlineNumberEdit } from '../../primitives/InlineNumberEdit';

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
  step: string;
  className?: string;
  inputClassName?: string;
  tdClassName?: string;
  indicator?: ReactNode;
};

export function GeneratedItemEditableNumberCell({
  value,
  onSave,
  step,
  className,
  inputClassName,
  tdClassName,
  indicator,
}: GeneratedItemEditableNumberCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    const numberValue = Number(draft);
    if (Number.isFinite(numberValue) && numberValue >= 0 && numberValue !== value) {
      await onSave(numberValue);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  if (!editing) {
    return (
      <td className={cn('px-3 py-2', tdClassName)} onClick={(event) => event.stopPropagation()}>
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
            'block cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-neutral-700 hover:bg-brand-50',
            className,
          )}
        >
          {value}
        </span>
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
        onChange={(event) => setDraft(event.target.value)}
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

type GeneratedItemEditableMoneyCellProps = {
  valueCents: number;
  onSave: (valueCents: number) => Promise<void> | void;
  indicator?: ReactNode;
  tdClassName?: string;
  inputClassName?: string;
};

export function GeneratedItemEditableMoneyCell({
  valueCents,
  onSave,
  indicator,
  tdClassName,
  inputClassName,
}: GeneratedItemEditableMoneyCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((valueCents / 100).toString());
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (nextCents !== valueCents) await onSave(nextCents);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft((valueCents / 100).toString());
    setEditing(false);
  };

  if (!editing) {
    return (
      <td className={cn('px-3 py-2', tdClassName)} onClick={(event) => event.stopPropagation()}>
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
          className="block cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-neutral-700 hover:bg-brand-50"
        >
          {formatMoney(cents(valueCents))}
        </span>
      </td>
    );
  }

  return (
    <td className={cn('px-3 py-2', tdClassName)} onClick={(event) => event.stopPropagation()}>
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
          onChange={(event) => setDraft(event.target.value)}
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
    </td>
  );
}

type GeneratedItemEditableQuantityCellProps = {
  quantity: number;
  quantityUnit: string;
  quantityUnits: readonly string[];
  onSaveQuantity: (value: number) => Promise<void> | void;
  onSaveUnit: (value: string) => Promise<void> | void;
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
  indicator,
  tdClassName,
  inputClassName,
}: GeneratedItemEditableQuantityCellProps) {
  const [editing, setEditing] = useState(false);

  const saveQuantity = (rawValue: string) => {
    const value = Number(rawValue);
    if (Number.isFinite(value) && value >= 0) void onSaveQuantity(value);
  };

  if (!editing) {
    return (
      <td className={cn('px-3 py-2', tdClassName)} onClick={(event) => event.stopPropagation()}>
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
          className="block cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-neutral-700 hover:bg-brand-50"
        >
          {quantity} {quantityUnit}
        </span>
      </td>
    );
  }

  return (
    <td className={cn('px-3 py-2', tdClassName)} onClick={(event) => event.stopPropagation()}>
      <div
        className="flex flex-col gap-1"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
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
    </td>
  );
}
