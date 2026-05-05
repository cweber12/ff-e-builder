import { describe, expect, it, vi, beforeEach } from 'vitest';
import { csvCell, fmtMoney, fmtPct, safeName, triggerDownload } from './shared';

describe('export shared helpers', () => {
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    revokeObjectUrl = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:export-url');
    globalThis.URL.revokeObjectURL = revokeObjectUrl;
  });

  it('normalizes names for export filenames', () => {
    expect(safeName(' Project: "FF&E" 2024! ')).toBe('project-ff-e-2024');
  });

  it('formats money and percentages for export rows', () => {
    expect(fmtMoney(123456)).toBe('$1,234.56');
    expect(fmtPct(35)).toBe('35%');
  });

  it('escapes CSV cells with quotes', () => {
    expect(csvCell('Walnut, "premium"')).toBe('"Walnut, ""premium"""');
  });

  it('triggers a browser download and revokes the object URL', () => {
    const click = vi.fn();
    const mockLink = {
      href: '',
      download: '',
      click,
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);

    const blob = new Blob(['content'], { type: 'text/plain' });
    triggerDownload(blob, 'export.txt');

    expect(mockLink.href).toBe('blob:export-url');
    expect(mockLink.download).toBe('export.txt');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:export-url');
  });
});
