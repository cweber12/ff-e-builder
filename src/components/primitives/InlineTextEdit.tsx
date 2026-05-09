import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from '../../lib/utils';

interface InlineTextEditProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  /** Rendered when not in edit mode */
  renderDisplay?: (value: string) => ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  rows?: number;
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
  multiline = false,
  rows = 4,
  'aria-label': ariaLabel,
}: InlineTextEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

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
    if (editing) {
      inputRef.current?.focus();
      if (!multiline) inputRef.current?.select();
    }
  }, [editing, multiline]);

  if (!editing) {
    return (
      <div
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
          'cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-brand-50',
          className,
        )}
      >
        {renderDisplay
          ? renderDisplay(value)
          : value || <span className="text-gray-400">{placeholder}</span>}
      </div>
    );
  }

  return (
    <div className={cn('relative flex flex-col gap-1', className)}>
      {multiline ? (
        <textarea
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          value={draft}
          rows={rows}
          aria-label={ariaLabel}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (
              (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ||
              (e.key === 'Enter' && e.shiftKey)
            ) {
              e.preventDefault();
              void commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          className={cn(
            'rounded border px-2 py-1 text-inherit bg-surface focus:outline-none',
            saveState === 'saving' && 'border-l-2 border-brand-500 animate-pulse',
            saveState === 'error' && 'border-danger-500',
            saveState === 'idle' && 'border-gray-300 focus:border-brand-500',
            inputClassName,
          )}
        />
      ) : (
        <input
          ref={inputRef as RefObject<HTMLInputElement>}
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
      )}
      {saveState === 'error' && (
        <span
          role="tooltip"
          className="absolute top-full left-0 mt-1 rounded bg-danger-500 px-2 py-1 text-xs text-white whitespace-nowrap z-10"
        >
          {errorMsg}
        </span>
      )}
    </div>
  );
}
