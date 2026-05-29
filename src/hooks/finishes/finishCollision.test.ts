import { describe, expect, it } from 'vitest';
import type { Finish } from '../../types';
import { detectFinishCollision, normalizeFinishName } from './finishCollision';

function makeFinish(id: string, name: string): Finish {
  return {
    id,
    projectId: 'project-1',
    code: '',
    name,
    category: null,
    subCategory: '',
    description: '',
    manufacturer: '',
    sourceUrl: '',
    swatchHex: '#D9D4C8',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('normalizeFinishName', () => {
  it('trims whitespace', () => {
    expect(normalizeFinishName('  Walnut  ')).toBe('walnut');
  });

  it('lowercases', () => {
    expect(normalizeFinishName('MAPLE')).toBe('maple');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeFinishName('   ')).toBe('');
  });
});

describe('detectFinishCollision', () => {
  const finishes = [
    makeFinish('f1', 'Walnut'),
    makeFinish('f2', 'Oak'),
    makeFinish('f3', 'Maple Stain'),
  ];

  it('returns null when name is empty after trimming', () => {
    expect(detectFinishCollision('', finishes)).toBeNull();
    expect(detectFinishCollision('   ', finishes)).toBeNull();
  });

  it('returns null when no finish matches', () => {
    expect(detectFinishCollision('Cherry', finishes)).toBeNull();
  });

  it('detects exact match', () => {
    expect(detectFinishCollision('Walnut', finishes)).toBe(finishes[0]);
  });

  it('detects case-insensitive match', () => {
    expect(detectFinishCollision('walnut', finishes)).toBe(finishes[0]);
    expect(detectFinishCollision('WALNUT', finishes)).toBe(finishes[0]);
  });

  it('detects match after trimming surrounding whitespace', () => {
    expect(detectFinishCollision('  Oak  ', finishes)).toBe(finishes[1]);
  });

  it('matches multi-word names', () => {
    expect(detectFinishCollision('maple stain', finishes)).toBe(finishes[2]);
  });

  it('returns null for empty finish list', () => {
    expect(detectFinishCollision('Walnut', [])).toBeNull();
  });
});
