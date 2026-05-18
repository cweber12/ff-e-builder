export function thinBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  };
}

/** Thin sides and top with a slightly firmer bottom for column header rows. */
export function headerRowBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFBFBFBF' } },
    right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  };
}

/** Thin top rule for subtotal / grand-total rows. */
export function subtotalTopBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: 'FFBFBFBF' } },
    left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  };
}

export function tableBorderSide() {
  return { style: 'thin' as const, color: { argb: 'FFB8C0C8' } };
}

export function tableBorder() {
  const side = tableBorderSide();
  return {
    top: side,
    left: side,
    bottom: side,
    right: side,
  };
}
