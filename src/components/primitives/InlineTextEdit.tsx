import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface InlineTextEditProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  /** Rendered when not in edit mode */
  renderDisplay?: (value: string) => ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  'aria-label'?: string;
}

type SaveState = 'idle' | 'saving' | 'error';

export function InlineTextEdit({
  value,
  onSave,
  renderDisplay,
  placeholder = 'Click to edit',
  className,
  inputClassName,
  'aria-label': ariaLabel,
}: InlineTextEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync when external value changes while not editing
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const enterEdit = () => {
    setDraft(value);
    setSaveState('idle');
    setErrorMsg('');
    setEditing(true);
  };

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaveState('saving');
    try {
      await onSave(trimmed);
      setSaveState('idle');
      setEditing(false);
    } catch (err) {
      setSaveState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
      // Revert the display value but keep draft so user can retry
    }
  };

  const cancel = () => {
    setDraft(value);
    setSaveState('idle');
    setErrorMsg('');
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={ariaLabel ?? `Edit ${value}`}
        onClick={enterEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            enterEdit();
          }
        }}
        className={cn(
          'cursor-pointer rounded px-1 -mx-1 hover:bg-brand-50 transition-colors',
          className,
        )}
      >
        {renderDisplay
          ? renderDisplay(value)
          : value || <span className="text-gray-400">{placeholder}</span>}
      </span>
    );
  }

  return (
    <span className="relative inline-flex flex-col gap-1">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
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
          'rounded border px-2 py-0.5 text-inherit bg-surface focus:outline-none',
          saveState === 'saving' && 'border-l-2 border-brand-500 animate-pulse',
          saveState === 'error' && 'border-danger-500',
          saveState === 'idle' && 'border-gray-300 focus:border-brand-500',
          inputClassName,
        )}
      />
      {saveState === 'error' && (
        <span
          role="tooltip"
          className="absolute top-full left-0 mt-1 rounded bg-danger-500 px-2 py-1 text-xs text-white whitespace-nowrap z-10"
        >
          {errorMsg}
        </span>
      )}
    </span>
  );
}
