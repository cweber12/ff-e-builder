import { useCallback, useEffect, useRef } from 'react';

export function useDebouncedSave<T>(onSave: (value: T) => Promise<void> | void, debounceMs = 0) {
  const onSaveRef = useRef(onSave);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T | null>(null);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const saveNow = useCallback(async (value: T) => {
    await onSaveRef.current(value);
  }, []);

  const flush = useCallback(async () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingValueRef.current === null) return;

    const nextValue = pendingValueRef.current;
    pendingValueRef.current = null;
    await saveNow(nextValue);
  }, [saveNow]);

  const schedule = useCallback(
    (value: T) => {
      if (debounceMs <= 0) {
        void saveNow(value);
        return;
      }

      pendingValueRef.current = value;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        void flush();
      }, debounceMs);
    },
    [debounceMs, flush, saveNow],
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingValueRef.current = null;
  }, []);

  const hasPending = useCallback(() => pendingValueRef.current !== null, []);

  return { saveNow, schedule, flush, cancel, hasPending };
}
