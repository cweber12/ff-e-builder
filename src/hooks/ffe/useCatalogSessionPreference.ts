import { useState } from 'react';

export function useCatalogSessionPreference<T>(defaultValue: T): [T, (value: T) => void] {
  return useState<T>(defaultValue);
}
