import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDebouncedSave } from './useDebouncedSave';

function DebounceHarness({
  onSave,
  debounceMs,
}: {
  onSave: (value: string) => Promise<void> | void;
  debounceMs: number;
}) {
  const debouncedSave = useDebouncedSave(onSave, debounceMs);

  return (
    <div>
      <button type="button" onClick={() => debouncedSave.schedule('first')}>
        schedule-first
      </button>
      <button type="button" onClick={() => debouncedSave.schedule('final')}>
        schedule-final
      </button>
      <button type="button" onClick={() => void debouncedSave.flush()}>
        flush
      </button>
    </div>
  );
}

describe('useDebouncedSave', () => {
  it('coalesces scheduled saves and persists only the final value', () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(<DebounceHarness onSave={onSave} debounceMs={400} />);

    fireEvent.click(screen.getByRole('button', { name: 'schedule-first' }));
    fireEvent.click(screen.getByRole('button', { name: 'schedule-final' }));

    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(401);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('final');
    vi.useRealTimers();
  });

  it('flushes a pending save immediately', () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(<DebounceHarness onSave={onSave} debounceMs={400} />);

    fireEvent.click(screen.getByRole('button', { name: 'schedule-final' }));

    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'flush' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('final');
    vi.useRealTimers();
  });
});
