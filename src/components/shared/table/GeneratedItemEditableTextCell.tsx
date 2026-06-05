import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { EditablePencilHint } from './EditablePencilHint';
import { useDebouncedSave } from './useDebouncedSave';

type EditableTextAffordance = 'none' | 'hover';

type GeneratedItemEditableTextCellProps = {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  debounceMs?: number;
  className?: string;
  indicator?: ReactNode;
  inputClassName?: string;
  displayClassName?: string;
  ariaLabel?: string;
  normalizeValue?: (value: string) => string;
  affordance?: EditableTextAffordance;
  autoFocus?: boolean;
  /** Enable true multi-line editing (Enter inserts newline, Cmd/Ctrl+Enter commits). */
  multiline?: boolean;
};

type GeneratedItemEditableTextControlProps = {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  debounceMs?: number;
  indicator?: ReactNode;
  inputClassName?: string | undefined;
  ariaLabel?: string | undefined;
  displayClassName?: string | undefined;
  normalizeValue?: ((value: string) => string) | undefined;
  affordance?: EditableTextAffordance | undefined;
  autoFocus?: boolean | undefined;
  multiline?: boolean | undefined;
};

export function GeneratedItemEditableTextCell({
  value,
  onSave,
  debounceMs = 0,
  className,
  indicator,
  inputClassName,
  displayClassName,
  ariaLabel,
  normalizeValue,
  affordance = 'none',
  autoFocus,
  multiline,
}: GeneratedItemEditableTextCellProps) {
  return (
    <td
      className={cn('relative px-3 py-2 align-top', className)}
      onClick={(event) => event.stopPropagation()}
    >
      <GeneratedItemEditableTextControl
        value={value}
        onSave={onSave}
        debounceMs={debounceMs}
        indicator={indicator}
        inputClassName={inputClassName}
        displayClassName={displayClassName}
        ariaLabel={ariaLabel}
        normalizeValue={normalizeValue}
        affordance={affordance}
        autoFocus={autoFocus}
        multiline={multiline}
      />
      <EditablePencilHint />
    </td>
  );
}

export function GeneratedItemEditableTextControl({
  value,
  onSave,
  debounceMs = 0,
  indicator,
  inputClassName,
  ariaLabel,
  displayClassName,
  normalizeValue = (nextValue) => nextValue,
  affordance = 'none',
  autoFocus,
  multiline = false,
}: GeneratedItemEditableTextControlProps) {
  const [editing, setEditing] = useState(() => Boolean(autoFocus));
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debouncedSave = useDebouncedSave(onSave, debounceMs);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    if (multiline) {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      autoSizeTextarea(ta);
    } else {
      inputRef.current?.select();
    }
  }, [editing, multiline]);

  const enterEdit = () => {
    setDraft(value);
    setSaveState('idle');
    setErrorMsg('');
    setEditing(true);
  };

  const commit = async () => {
    const nextValue = normalizeValue(draft);
    if (nextValue === value) {
      debouncedSave.cancel();
      setSaveState('idle');
      setEditing(false);
      return;
    }

    setSaveState('saving');
    if (debounceMs > 0) {
      debouncedSave.schedule(nextValue);
      try {
        await debouncedSave.flush();
      } catch (error) {
        setSaveState('error');
        setErrorMsg(error instanceof Error ? error.message : 'Save failed');
        return;
      }
      setSaveState('idle');
      setEditing(false);
      return;
    }

    try {
      await debouncedSave.saveNow(nextValue);
      setSaveState('idle');
      setEditing(false);
    } catch (error) {
      setSaveState('error');
      setErrorMsg(error instanceof Error ? error.message : 'Save failed');
    }
  };

  const cancel = () => {
    debouncedSave.cancel();
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
            multiline && 'whitespace-pre-wrap break-words',
            isEmpty
              ? 'border border-neutral-300 text-neutral-400 hover:border-brand-500'
              : 'text-neutral-700 hover:bg-neutral-100',
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

  const handleChange = (nextDraft: string) => {
    setDraft(nextDraft);
    if (debounceMs <= 0) return;
    const nextValue = normalizeValue(nextDraft);
    if (nextValue === value) {
      debouncedSave.cancel();
      setSaveState('idle');
      return;
    }
    setSaveState('saving');
    setErrorMsg('');
    debouncedSave.schedule(nextValue);
  };

  const inputClasses = cn(
    'w-full rounded border px-2 py-1 text-sm text-inherit bg-surface focus:outline-none',
    saveState === 'saving' && 'border-l-2 border-brand-500 animate-pulse',
    saveState === 'error' && 'border-danger-500',
    saveState === 'idle' && 'border-neutral-300 focus:border-brand-500',
    inputClassName,
  );

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={draft}
          aria-label={ariaLabel}
          rows={1}
          onChange={(event) => {
            handleChange(event.target.value);
            autoSizeTextarea(event.currentTarget);
          }}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            // Cmd/Ctrl+Enter commits; plain Enter inserts newline (default behavior).
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
          className={cn(inputClasses, 'resize-none whitespace-pre-wrap break-words leading-snug')}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          aria-label={ariaLabel}
          onChange={(event) => handleChange(event.target.value)}
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
          className={inputClasses}
        />
      )}
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

function autoSizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export type { EditableTextAffordance };
