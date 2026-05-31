import type { SaveState } from '../../hooks/shared/useSaveStatus';
import { Button } from '../primitives';

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
        <>
          <span className="text-danger-600">save failed ·</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={errorAction}
            className="text-link h-auto px-1 text-[11px] text-danger-600 hover:bg-transparent hover:text-danger-600"
          >
            Retry
          </Button>
        </>
      )}
    </div>
  );
}
