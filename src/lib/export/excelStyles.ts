export function thinBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  };
}

/** Thin sides and top, medium-weight bottom — for column header rows. */
export function headerRowBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFBFBFBF' } },
    right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  };
}

/** Medium-weight top, thin others — for subtotal / grand-total rows. */
export function subtotalTopBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: 'FFBFBFBF' } },
    left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  };
}
