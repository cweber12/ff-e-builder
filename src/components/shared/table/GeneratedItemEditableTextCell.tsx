import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

type GeneratedItemEditableTextCellProps = {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  className?: string;
  indicator?: ReactNode;
  inputClassName?: string;
  ariaLabel?: string;
  normalizeValue?: (value: string) => string;
};

type GeneratedItemEditableTextControlProps = {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  indicator?: ReactNode;
  inputClassName?: string;
  ariaLabel?: string;
  displayClassName?: string;
  normalizeValue?: (value: string) => string;
};

export function GeneratedItemEditableTextCell({
  value,
  onSave,
  className,
  indicator,
  inputClassName,
  ariaLabel,
  normalizeValue,
}: GeneratedItemEditableTextCellProps) {
  return (
    <td className={cn('px-3 py-2', className)} onClick={(event) => event.stopPropagation()}>
      <GeneratedItemEditableTextControl
        value={value}
        onSave={onSave}
        indicator={indicator}
        inputClassName={inputClassName}
        ariaLabel={ariaLabel}
        normalizeValue={normalizeValue}
      />
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
            'block w-full cursor-pointer rounded px-2 py-1 text-sm',
            isEmpty
              ? 'border border-gray-300 text-gray-400 hover:border-brand-500'
              : 'text-gray-700 hover:bg-brand-50',
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
          saveState === 'idle' && 'border-gray-300 focus:border-brand-500',
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
