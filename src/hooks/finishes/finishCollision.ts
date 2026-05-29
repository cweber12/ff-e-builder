import type { Finish } from '../../types';

export function normalizeFinishName(name: string): string {
  return name.trim().toLowerCase();
}

export function detectFinishCollision(name: string, finishes: Finish[]): Finish | null {
  const normalized = normalizeFinishName(name);
  if (!normalized) return null;
  return finishes.find((f) => normalizeFinishName(f.name) === normalized) ?? null;
}
