import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const DISPLAY_DELAY_MS = 200;
const SAVED_FADE_MS = 60_000; // 60s then fade out

function relativeTime(ts: number): string {
  const elapsed = Math.floor((Date.now() - ts) / 1000);
  if (elapsed < 2) return 'just now';
  if (elapsed < 60) return `${elapsed}s ago`;
  return `${Math.floor(elapsed / 60)}m ago`;
}

/**
 * Subscribes to React Query mutation state for the current table.
 * Shows saving…, saved · <relative time>, or save failed · retry.
 *
 * `mutationKey` is an optional prefix to scope to a specific mutation group.
 */
export function useSaveStatus(mutationKey?: string[]) {
  const isMutating = useIsMutating(mutationKey ? { mutationKey } : {});
  const [state, setState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorAction, setErrorAction] = useState<(() => void) | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMutatingRef = useRef(0);

  // Transition: idle→saving (with 200ms delay), saving→saved/error
  useEffect(() => {
    if (isMutating > 0 && prevMutatingRef.current === 0) {
      // Mutation started — show "saving…" after DISPLAY_DELAY_MS
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      showTimerRef.current = setTimeout(() => {
        if (isMutating > 0) setState('saving');
      }, DISPLAY_DELAY_MS);
    } else if (isMutating === 0 && prevMutatingRef.current > 0) {
      // Mutation finished — assume success (React Query will surface errors via onError)
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      setState('saved');
      setSavedAt(Date.now());
      // Fade out after SAVED_FADE_MS
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => setState('idle'), SAVED_FADE_MS);
    }
    prevMutatingRef.current = isMutating;
  }, [isMutating]);

  // Tick relative time every 2s while in saved state
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (state !== 'saved') return;
    const interval = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(interval);
  }, [state]);

  const markError = useCallback((retryFn: () => void) => {
    setState('error');
    setErrorAction(() => retryFn);
  }, []);

  const relTime = savedAt ? relativeTime(savedAt) : null;

  return { state, relTime, markError, errorAction, tick };
}
