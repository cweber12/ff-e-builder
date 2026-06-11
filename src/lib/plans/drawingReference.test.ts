import { describe, expect, it } from 'vitest';
import { appendDrawingReference, getMeasuredPlanDrawingReference } from './drawingReference';

describe('drawingReference helpers', () => {
  it('uses sheet reference before plan name', () => {
    expect(
      getMeasuredPlanDrawingReference({
        name: 'Level 1 Furniture Plan',
        sheetReference: 'A1-1',
      }),
    ).toBe('A1-1');
  });

  it('falls back to plan name when sheet reference is blank', () => {
    expect(
      getMeasuredPlanDrawingReference({
        name: 'Level 1 Furniture Plan',
        sheetReference: '  ',
      }),
    ).toBe('Level 1 Furniture Plan');
  });

  it('appends missing drawing refs without overwriting existing refs', () => {
    expect(appendDrawingReference('A0-1', 'A1-1')).toBe('A0-1, A1-1');
  });

  it('does not duplicate existing refs', () => {
    expect(appendDrawingReference('A0-1, A1-1', 'a1-1')).toBe('A0-1, A1-1');
    expect(appendDrawingReference('A0-1\nA1-1', 'A1-1')).toBe('A0-1\nA1-1');
  });
});
