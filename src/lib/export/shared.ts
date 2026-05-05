import { cents, formatMoney } from '../../types';

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function safeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function fmtMoney(centsValue: number): string {
  return formatMoney(cents(centsValue));
}

export function fmtPct(value: number): string {
  return `${value}%`;
}

export function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
