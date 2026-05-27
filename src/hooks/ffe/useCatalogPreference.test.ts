import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogPreference } from './useCatalogPreference';

describe('useCatalogPreference', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns defaultValue when nothing is stored', () => {
    const { result } = renderHook(() => useCatalogPreference<string>('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('returns stored value when sessionStorage already has an entry', () => {
    sessionStorage.setItem('test-key', 'stored');
    const { result } = renderHook(() => useCatalogPreference<string>('test-key', 'default'));
    expect(result.current[0]).toBe('stored');
  });

  it('persists updated value to sessionStorage', () => {
    const { result } = renderHook(() => useCatalogPreference<string>('test-key', 'default'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(sessionStorage.getItem('test-key')).toBe('updated');
  });
});
