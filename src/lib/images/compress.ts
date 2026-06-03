const MAX_DIMENSION = 2400;
const WEBP_QUALITY = 0.9;

export async function compressImage(file: File): Promise<File> {
  // GIF may be animated — skip conversion to avoid losing frames
  if (file.type === 'image/gif') return file;
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let targetWidth = width;
  let targetHeight = height;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      targetWidth = MAX_DIMENSION;
      targetHeight = Math.round(height * (MAX_DIMENSION / width));
    } else {
      targetHeight = MAX_DIMENSION;
      targetWidth = Math.round(width * (MAX_DIMENSION / height));
    }
  }

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
}
