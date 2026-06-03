import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from './compress';

describe('compressImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rescales oversized uploads with the higher fidelity settings', async () => {
    const close = vi.fn();
    const bitmap = { width: 4800, height: 2400, close } as unknown as ImageBitmap;
    const drawImage = vi.fn();
    const convertToBlob = vi
      .fn()
      .mockResolvedValue(new Blob(['compressed'], { type: 'image/webp' }));
    const ctx = {
      drawImage,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low' as ImageSmoothingQuality,
    };

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}

        getContext() {
          return ctx;
        }

        convertToBlob = convertToBlob;
      },
    );

    const file = new File(['original'], 'chair.jpg', { type: 'image/jpeg' });
    const result = await compressImage(file);

    expect(ctx.imageSmoothingEnabled).toBe(true);
    expect(ctx.imageSmoothingQuality).toBe('high');
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2400, 1200);
    expect(convertToBlob).toHaveBeenCalledWith({ type: 'image/webp', quality: 0.9 });
    expect(close).toHaveBeenCalled();
    expect(result.name).toBe('chair.webp');
    expect(result.type).toBe('image/webp');
  });

  it('skips GIF compression to preserve animation frames', async () => {
    const file = new File(['animated'], 'animated.gif', { type: 'image/gif' });

    const result = await compressImage(file);

    expect(result).toBe(file);
  });
});
