import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { EditablePencilHint } from './EditablePencilHint';

type EditableTextAffordance = 'none' | 'hover';

type GeneratedItemEditableTextCellProps = {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  className?: string;
  indicator?: ReactNode;
  inputClassName?: string;
  displayClassName?: string;
  ariaLabel?: string;
  normalizeValue?: (value: string) => string;
  affordance?: EditableTextAffordance;
};

type GeneratedItemEditableTextControlProps = {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  indicator?: ReactNode;
  inputClassName?: string | undefined;
  ariaLabel?: string | undefined;
  displayClassName?: string | undefined;
  normalizeValue?: ((value: string) => string) | undefined;
  affordance?: EditableTextAffordance | undefined;
};

export function GeneratedItemEditableTextCell({
  value,
  onSave,
  className,
  indicator,
  inputClassName,
  displayClassName,
  ariaLabel,
  normalizeValue,
  affordance = 'none',
}: GeneratedItemEditableTextCellProps) {
  return (
    <td
      className={cn('relative px-3 py-2', className)}
      onClick={(event) => event.stopPropagation()}
    >
      <GeneratedItemEditableTextControl
        value={value}
        onSave={onSave}
        indicator={indicator}
        inputClassName={inputClassName}
        displayClassName={displayClassName}
        ariaLabel={ariaLabel}
        normalizeValue={normalizeValue}
        affordance={affordance}
      />
      <EditablePencilHint />
    </td>
  );
}

export function GeneratedItemEditableTextControl({
  value,
  onSave,
  indicator,
  inputClassName,
  ariaLabel,
  displayClassName,
  normalizeValue = (nextValue) => nextValue,
  affordance = 'none',
}: GeneratedItemEditableTextControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const enterEdit = () => {
    setDraft(value);
    setSaveState('idle');
    setErrorMsg('');
    setEditing(true);
  };

  const commit = async () => {
    const nextValue = normalizeValue(draft);
    if (nextValue === value) {
      setEditing(false);
      return;
    }

    setSaveState('saving');
    try {
      await onSave(nextValue);
      setSaveState('idle');
      setEditing(false);
    } catch (error) {
      setSaveState('error');
      setErrorMsg(error instanceof Error ? error.message : 'Save failed');
    }
  };

  const cancel = () => {
    setDraft(value);
    setSaveState('idle');
    setErrorMsg('');
    setEditing(false);
  };

  if (!editing) {
    const isEmpty = !value;
    return (
      <>
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          aria-label={ariaLabel ?? `Edit ${value}`}
          onClick={enterEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              enterEdit();
            }
          }}
          className={cn(
            'block w-full cursor-text rounded px-2 py-1 text-sm',
            isEmpty
              ? 'border border-neutral-300 text-neutral-400 hover:border-brand-500'
              : 'text-neutral-700 hover:bg-brand-50',
            affordance === 'hover' &&
              'motion-reduce:transition-none motion-safe:transition-colors underline decoration-1 underline-offset-4 decoration-transparent group-hover:decoration-brand-200',
            displayClassName,
          )}
        >
          {isEmpty ? '-' : value}
        </span>
      </>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        aria-label={ariaLabel}
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
        className={cn(
          'w-full rounded border px-2 py-1 text-sm text-inherit bg-surface focus:outline-none',
          saveState === 'saving' && 'border-l-2 border-brand-500 animate-pulse',
          saveState === 'error' && 'border-danger-500',
          saveState === 'idle' && 'border-neutral-300 focus:border-brand-500',
          inputClassName,
        )}
      />
      {saveState === 'error' && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded bg-danger-500 px-2 py-1 text-xs text-white"
        >
          {errorMsg}
        </span>
      )}
    </div>
  );
}

export type { EditableTextAffordance };
