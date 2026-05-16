import { api } from '../api';
import type { CropParams, ImageAsset } from '../../types';
import type { Workbook, Worksheet } from 'exceljs';

const DEFAULT_EXCEL_IMAGE_PADDING_PX = 2;

export type ExcelImageBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ExcelImagePlacement = {
  box: ExcelImageBox;
  widthPx: number;
  heightPx: number;
};

export type ExcelImageCellPlacementOptions = {
  columnIndex: number;
  rowNumber: number;
  columnWidth: number;
  rowHeight: number;
  paddingPx?: number;
};

export async function blobToPngDataUrl(blob: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Unable to load export image.'));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width || 1;
    canvas.height = image.naturalHeight || image.height || 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare export image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function imageAssetToPngDataUrl(image: ImageAsset): Promise<string | null> {
  try {
    const dataUrl = await blobToPngDataUrl(await api.images.getContentBlob(image.id));
    if (!dataUrl) return null;
    if (
      image.cropX !== null &&
      image.cropY !== null &&
      image.cropWidth !== null &&
      image.cropHeight !== null
    ) {
      return cropDataUrlToRect(dataUrl, {
        cropX: image.cropX,
        cropY: image.cropY,
        cropWidth: image.cropWidth,
        cropHeight: image.cropHeight,
      });
    }
    return dataUrl;
  } catch {
    return null;
  }
}

function addExcelImage(
  worksheet: Worksheet,
  imageId: number,
  position: {
    tl: { col: number; row: number };
    ext: { width: number; height: number };
  },
) {
  // 'oneCellAnchor' with explicit ext dimensions: image is placed at tl and
  // rendered at exactly ext.width x ext.height pixels. The embedded PNG retains
  // full resolution so quality is preserved when the user resizes in Excel.
  worksheet.addImage(imageId, {
    tl: position.tl,
    ext: position.ext,
  });
}

function excelColumnWidthToPixels(width: number) {
  return Math.max(1, Math.round(width * 7 + 5));
}

function excelRowHeightToPixels(heightPoints: number) {
  return Math.max(1, Math.round(heightPoints * (96 / 72)));
}

export function excelPaddedCellPlacement(
  columnIndex: number,
  rowNumber: number,
  columnWidth: number,
  rowHeight: number,
  paddingPx = DEFAULT_EXCEL_IMAGE_PADDING_PX,
): ExcelImagePlacement {
  const widthPx = excelColumnWidthToPixels(columnWidth);
  const heightPx = excelRowHeightToPixels(rowHeight);
  const horizontalInset = Math.min(0.45, paddingPx / widthPx);
  const verticalInset = Math.min(0.45, paddingPx / heightPx);
  return {
    box: {
      left: columnIndex + horizontalInset,
      top: rowNumber - 1 + verticalInset,
      right: columnIndex + 1 - horizontalInset,
      bottom: rowNumber - verticalInset,
    },
    widthPx: Math.max(1, widthPx - paddingPx * 2),
    heightPx: Math.max(1, heightPx - paddingPx * 2),
  };
}

/**
 * Centers a fixed-size image inside a cell.
 * The image is rendered at exactly targetWidthPx × targetHeightPx (clamped to
 * the cell dimensions) with equal padding on all sides.
 */
export function excelCenteredFixedImagePlacement(
  columnIndex: number,
  rowNumber: number,
  columnWidth: number,
  rowHeight: number,
  targetWidthPx: number,
  targetHeightPx: number,
): ExcelImagePlacement {
  const cellWidthPx = excelColumnWidthToPixels(columnWidth);
  const cellHeightPx = excelRowHeightToPixels(rowHeight);
  const imgW = Math.min(targetWidthPx, cellWidthPx);
  const imgH = Math.min(targetHeightPx, cellHeightPx);
  const hPad = (cellWidthPx - imgW) / 2;
  const vPad = (cellHeightPx - imgH) / 2;
  const horizontalInset = Math.min(0.45, hPad / cellWidthPx);
  const verticalInset = Math.min(0.45, vPad / cellHeightPx);
  return {
    box: {
      left: columnIndex + horizontalInset,
      top: rowNumber - 1 + verticalInset,
      right: columnIndex + 1 - horizontalInset,
      bottom: rowNumber - verticalInset,
    },
    widthPx: imgW,
    heightPx: imgH,
  };
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load export image.'));
    image.src = src;
  });
}

function imageDimensions(image: HTMLImageElement) {
  return {
    width: image.naturalWidth || image.width || 1,
    height: image.naturalHeight || image.height || 1,
  };
}

export async function addExcelAspectFitImage(
  workbook: Workbook,
  worksheet: Worksheet,
  dataUrl: string,
  options: ExcelImageCellPlacementOptions,
) {
  const image = await loadImageElement(dataUrl);
  const source = imageDimensions(image);
  const cellWidthPx = excelColumnWidthToPixels(options.columnWidth);
  const cellHeightPx = excelRowHeightToPixels(options.rowHeight);
  const paddingPx = options.paddingPx ?? DEFAULT_EXCEL_IMAGE_PADDING_PX;
  const boxWidthPx = Math.max(1, cellWidthPx - paddingPx * 2);
  const boxHeightPx = Math.max(1, cellHeightPx - paddingPx * 2);
  const sourceAspect = source.width / source.height;
  const boxAspect = boxWidthPx / boxHeightPx;
  const widthPx = sourceAspect > boxAspect ? boxWidthPx : Math.max(1, boxHeightPx * sourceAspect);
  const heightPx = sourceAspect > boxAspect ? Math.max(1, boxWidthPx / sourceAspect) : boxHeightPx;
  const leftPaddingPx = paddingPx + (boxWidthPx - widthPx) / 2;
  const topPaddingPx = paddingPx + (boxHeightPx - heightPx) / 2;

  const imageId = workbook.addImage({
    base64: dataUrl,
    extension: 'png',
  });
  addExcelImage(worksheet, imageId, {
    tl: {
      col: options.columnIndex + leftPaddingPx / cellWidthPx,
      row: options.rowNumber - 1 + topPaddingPx / cellHeightPx,
    },
    ext: {
      width: Math.max(1, Math.round(widthPx)),
      height: Math.max(1, Math.round(heightPx)),
    },
  });
}

async function cropDataUrlToRect(
  dataUrl: string,
  params: CropParams,
  maxOutputPx = Number.POSITIVE_INFINITY,
): Promise<string> {
  const image = await loadImageElement(dataUrl);
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  const cropX = params.cropX * srcW;
  const cropY = params.cropY * srcH;
  const cropW = params.cropWidth * srcW;
  const cropH = params.cropHeight * srcH;
  const scale = Math.min(1, maxOutputPx / Math.max(cropW, cropH));
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to prepare export image.');
  ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
  return canvas.toDataURL('image/png');
}

export async function cropDataUrlToCover(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number,
  maxOutputPx = 1600,
): Promise<string> {
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round(targetHeight));
  const image = await loadImageElement(dataUrl);
  const sourceWidth = image.naturalWidth || image.width || width;
  const sourceHeight = image.naturalHeight || image.height || height;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = width / height;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceAspect > targetAspect) {
    cropWidth = sourceHeight * targetAspect;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetAspect;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  // Output at original source resolution, capped at maxOutputPx.
  // targetWidth/targetHeight are used only for the aspect-ratio crop above.
  const scale = Math.min(1, maxOutputPx / Math.max(cropWidth, cropHeight));
  const outWidth = Math.max(1, Math.round(cropWidth * scale));
  const outHeight = Math.max(1, Math.round(cropHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare export image.');
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, outWidth, outHeight);
  return canvas.toDataURL('image/png');
}

export async function addExcelCoverImage(
  workbook: Workbook,
  worksheet: Worksheet,
  dataUrl: string,
  placement: ExcelImagePlacement,
  targetWidth: number,
  targetHeight: number,
) {
  const imageId = workbook.addImage({
    base64: await cropDataUrlToCover(dataUrl, targetWidth, targetHeight, Number.POSITIVE_INFINITY),
    extension: 'png',
  });
  addExcelImage(worksheet, imageId, {
    tl: { col: placement.box.left, row: placement.box.top },
    ext: { width: placement.widthPx, height: placement.heightPx },
  });
}

async function scaleDataUrlToContain(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number,
  maxOutputPx = Number.POSITIVE_INFINITY,
): Promise<string> {
  const cellW = Math.max(1, Math.round(targetWidth));
  const cellH = Math.max(1, Math.round(targetHeight));
  const image = await loadImageElement(dataUrl);
  const srcW = image.naturalWidth || image.width || cellW;
  const srcH = image.naturalHeight || image.height || cellH;

  // Scale source to output resolution, capped at maxOutputPx on the longer side.
  const outputScale = Math.min(1, maxOutputPx / Math.max(srcW, srcH));
  const drawW = Math.max(1, Math.round(srcW * outputScale));
  const drawH = Math.max(1, Math.round(srcH * outputScale));

  // Canvas matches the cell's aspect ratio and is sized to contain the drawn
  // image with transparent letterbox padding on the shorter axis.
  const cellAspect = cellW / cellH;
  const imageAspect = drawW / drawH;
  let canvasW: number, canvasH: number;
  if (imageAspect > cellAspect) {
    canvasW = drawW;
    canvasH = Math.max(1, Math.round(drawW / cellAspect));
  } else {
    canvasH = drawH;
    canvasW = Math.max(1, Math.round(drawH * cellAspect));
  }

  const drawX = Math.round((canvasW - drawW) / 2);
  const drawY = Math.round((canvasH - drawH) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare export image.');
  context.drawImage(image, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);
  return canvas.toDataURL('image/png');
}

export async function addExcelContainImage(
  workbook: Workbook,
  worksheet: Worksheet,
  dataUrl: string,
  placement: ExcelImagePlacement,
) {
  const imageId = workbook.addImage({
    base64: await scaleDataUrlToContain(dataUrl, placement.widthPx, placement.heightPx),
    extension: 'png',
  });
  addExcelImage(worksheet, imageId, {
    tl: { col: placement.box.left, row: placement.box.top },
    ext: { width: placement.widthPx, height: placement.heightPx },
  });
}

async function drawCircularCoverDataUrl(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number,
): Promise<string> {
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round(targetHeight));
  const image = await loadImageElement(dataUrl);
  const sourceWidth = image.naturalWidth || image.width || width;
  const sourceHeight = image.naturalHeight || image.height || height;
  const diameter = Math.max(1, Math.min(width, height));
  const circleX = (width - diameter) / 2;
  const circleY = (height - diameter) / 2;
  const scale = Math.max(diameter / sourceWidth, diameter / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare export image.');
  context.clearRect(0, 0, width, height);
  context.save();
  context.beginPath();
  context.arc(width / 2, height / 2, diameter / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    image,
    circleX + (diameter - drawWidth) / 2,
    circleY + (diameter - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  context.restore();
  return canvas.toDataURL('image/png');
}

export async function addExcelCircularCoverImage(
  workbook: Workbook,
  worksheet: Worksheet,
  dataUrl: string,
  placement: ExcelImagePlacement,
) {
  const imageId = workbook.addImage({
    base64: await drawCircularCoverDataUrl(dataUrl, placement.widthPx, placement.heightPx),
    extension: 'png',
  });
  addExcelImage(worksheet, imageId, {
    tl: { col: placement.box.left, row: placement.box.top },
    ext: { width: placement.widthPx, height: placement.heightPx },
  });
}

function excelColumnAnchorAtWidth(widths: number[], targetWidth: number) {
  const boundedTarget = Math.max(
    0,
    Math.min(
      targetWidth,
      widths.reduce((sum, width) => sum + width, 0),
    ),
  );
  let consumed = 0;
  for (const [index, width] of widths.entries()) {
    const next = consumed + width;
    if (boundedTarget <= next || index === widths.length - 1) {
      const fraction = width > 0 ? (boundedTarget - consumed) / width : 0;
      return index + Math.max(0, Math.min(1, fraction));
    }
    consumed = next;
  }
  return widths.length;
}

export function excelEqualWidthSlotPlacement(
  widths: number[],
  row: number,
  rowHeight: number,
  slot: number,
  slotCount: number,
): ExcelImagePlacement {
  const widthPixels = widths.map(excelColumnWidthToPixels);
  const totalWidthPx = widthPixels.reduce((sum, width) => sum + width, 0);
  const slotWidthPx = Math.floor(totalWidthPx / slotCount);
  const isLastSlot = slot === slotCount - 1;
  return {
    box: {
      left: excelColumnAnchorAtWidth(widthPixels, slot * slotWidthPx),
      top: row - 1,
      // Last slot extends to the very end of the last column so images cover full width.
      right: isLastSlot
        ? widths.length
        : excelColumnAnchorAtWidth(widthPixels, (slot + 1) * slotWidthPx),
      bottom: row,
    },
    widthPx: isLastSlot ? totalWidthPx - slotWidthPx * slot : slotWidthPx,
    heightPx: excelRowHeightToPixels(rowHeight),
  };
}
