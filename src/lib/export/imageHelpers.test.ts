import { describe, expect, it } from 'vitest';
import { excelSquareGridPlacements } from './imageHelpers';

describe('export image helpers', () => {
  it('places every swatch as a square in a centered grid', () => {
    const placements = excelSquareGridPlacements({
      columnIndex: 3,
      rowNumber: 8,
      columnWidth: 18,
      rowHeight: 120,
      paddingPx: 7,
      imageCount: 5,
      columnCount: 2,
      gapPx: 5,
      maxImageSizePx: 42,
    });

    expect(placements).toHaveLength(5);
    expect(placements.every((placement) => placement.widthPx === placement.heightPx)).toBe(true);
    expect(placements.every((placement) => placement.widthPx <= 42)).toBe(true);
    expect(placements[1]!.box.left).toBeGreaterThan(placements[0]!.box.right);
    expect(placements[2]!.box.top).toBeGreaterThan(placements[0]!.box.bottom);
    expect(placements[2]!.box.left).toBe(placements[0]!.box.left);
    expect(placements[1]!.anchor!.nativeColOffPx).toBeGreaterThan(
      placements[0]!.anchor!.nativeColOffPx,
    );
    expect(placements[2]!.anchor!.nativeRowOffPx).toBeGreaterThan(
      placements[0]!.anchor!.nativeRowOffPx,
    );
  });
});
