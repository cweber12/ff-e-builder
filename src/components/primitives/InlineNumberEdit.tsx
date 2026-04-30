import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

interface InlineNumberEditProps {
  value: number;
  onSave: (value: number) => Promise<void> | void;
  /** Format the number for display (e.g. formatMoney, formatPct). */
  formatter: (value: number) => string;
  /** Parse a raw string into a number. Return undefined if invalid. */
  parser?: (raw: string) => number | undefined;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  'aria-label'?: string;
}

type SaveState = 'idle' | 'saving' | 'error';

const defaultParser = (raw: string): number | undefined => {
  // Strip currency symbols, commas, percent signs
  const cleaned = raw.replace(/[$,% ]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

export function InlineNumberEdit({
  value,
  onSave,
  formatter,
  parser = defaultParser,
  min,
  max,
  placeholder = 'Double-click to edit',
  className,
  inputClassName,
  'aria-label': ariaLabel,
}: InlineNumberEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const enterEdit = () => {
    setDraft(String(value));
    setSaveState('idle');
    setErrorMsg('');
    setValidationError('');
    setEditing(true);
  };

  const validate = (raw: string): number | undefined => {
    const parsed = parser(raw);
    if (parsed === undefined) {
      setValidationError('Invalid number');
      return undefined;
    }
    if (min !== undefined && parsed < min) {
      setValidationError(`Minimum is ${min}`);
      return undefined;
    }
    if (max !== undefined && parsed > max) {
      setValidationError(`Maximum is ${max}`);
      return undefined;
    }
    setValidationError('');
    return parsed;
  };

  const commit = async () => {
    const parsed = validate(draft);
    if (parsed === undefined) {
      // keep editing so user can fix
      return;
    }
    if (parsed === value) {
      setEditing(false);
      return;
    }
    setSaveState('saving');
    try {
      await onSave(parsed);
      setSaveState('idle');
      setEditing(false);
    } catch (err) {
      setSaveState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
      // Draft preserved for retry
    }
  };

  const cancel = () => {
    setDraft('');
    setSaveState('idle');
    setErrorMsg('');
    setValidationError('');
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Keep display in sync if external value changes while not editing
  useEffect(() => {
    if (!editing) setDraft('');
  }, [value, editing]);

  const showError = validationError || (saveState === 'error' ? errorMsg : '');

  if (!editing) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 group', className)}>
        <span
          title={placeholder}
          onDoubleClick={enterEdit}
          className="tabular-nums cursor-default select-none"
        >
          {formatter(value)}
        </span>
        {/* Explicit pencil icon — clicking it enters edit mode */}
        <button
          type="button"
          aria-label={ariaLabel ? `Edit ${ariaLabel}` : 'Edit value'}
          onDoubleClick={enterEdit}
          onDoubleClickCapture={enterEdit}
          onClick={(e) => {
            // Single click on the pencil icon IS deliberate — allow it
            e.stopPropagation();
            enterEdit();
          }}
          className={cn(
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            'text-gray-400 hover:text-brand-500 transition-opacity',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 rounded',
          )}
        >
          {/* Pencil SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L2.68 10.846a.75.75 0 0 0-.196.37l-.647 3.22a.75.75 0 0 0 .895.895l3.22-.647a.75.75 0 0 0 .37-.196l8.333-8.333a1.75 1.75 0 0 0 0-2.475l-.167-.167Z" />
          </svg>
        </button>
        {/* Also allow double-click on the value itself */}
        <span onDoubleClick={enterEdit} aria-hidden="true" className="sr-only">
          double-click to edit
        </span>
      </span>
    );
  }

  return (
    <span className="relative inline-flex flex-col gap-1">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => {
          setDraft(e.target.value);
          setValidationError('');
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className={cn(
          'rounded border px-2 py-0.5 text-inherit bg-surface focus:outline-none tabular-nums',
          saveState === 'saving' && 'border-l-2 border-brand-500 animate-pulse',
          (saveState === 'error' || validationError) && 'border-danger-500',
          saveState === 'idle' && !validationError && 'border-gray-300 focus:border-brand-500',
          inputClassName,
        )}
      />
      {showError && (
        <span
          role="tooltip"
          className="absolute top-full left-0 mt-1 rounded bg-danger-500 px-2 py-1 text-xs text-white whitespace-nowrap z-10"
        >
          {showError}
        </span>
      )}
    </span>
  );
}
