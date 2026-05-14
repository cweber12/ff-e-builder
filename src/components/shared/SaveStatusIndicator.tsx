import type { SaveState } from '../../hooks/useSaveStatus';

interface SaveStatusIndicatorProps {
  state: SaveState;
  relTime: string | null;
  errorAction?: (() => void) | null;
}

export function SaveStatusIndicator({ state, relTime, errorAction }: SaveStatusIndicatorProps) {
  if (state === 'idle') return null;

  return (
    <div
      className="ml-4 inline-flex items-center font-mono text-[11px] text-neutral-400"
      aria-live="polite"
      aria-atomic="true"
    >
      {state === 'saving' && 'saving…'}
      {state === 'saved' && `saved · ${relTime ?? 'just now'}`}
      {state === 'error' && errorAction && (
        <button
          type="button"
          onClick={errorAction}
          className="text-[11px] text-danger-600 hover:underline"
        >
          save failed · retry
        </button>
      )}
    </div>
  );
}
