import { describe, expect, it } from 'vitest';
import { detectSheetReferenceFromTextItems } from './pdf';

describe('detectSheetReferenceFromTextItems', () => {
  it('detects sheet refs from the lower title block text items', () => {
    expect(
      detectSheetReferenceFromTextItems(
        [
          textItem('DEMOLITION REFLECTED', 87, 166, 122),
          textItem('D2-1', 105, 155, 38),
          textItem('2023.0235', 183, 128, 74),
        ],
        3456,
        2592,
      ),
    ).toBe('D2-1');
  });

  it('detects bottom-right title block sheet refs', () => {
    expect(
      detectSheetReferenceFromTextItems(
        [textItem('A1-2', 3100, 150, 44), textItem('A9-9', 1800, 1800, 44)],
        3456,
        2592,
      ),
    ).toBe('A1-2');
  });

  it('combines same-line text when the ref is split across PDF text items', () => {
    expect(
      detectSheetReferenceFromTextItems(
        [textItem('A1', 3050, 150, 22), textItem('- 3', 3076, 150, 24)],
        3456,
        2592,
      ),
    ).toBe('A1-3');
  });
});

function textItem(str: string, x: number, y: number, width: number) {
  return {
    str,
    transform: [1, 0, 0, 1, x, y],
    width,
    height: 12,
  };
}
