export type ImagePoint = {
  x: number;
  y: number;
};

export type LineDraft = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type RectDraft = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type RectBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MeasurementRect = {
  rectX: number;
  rectY: number;
  rectWidth: number;
  rectHeight: number;
};

export function normalizeRectDraft(rect: RectDraft): RectBounds {
  return {
    x: Math.min(rect.startX, rect.endX),
    y: Math.min(rect.startY, rect.endY),
    width: Math.abs(rect.endX - rect.startX),
    height: Math.abs(rect.endY - rect.startY),
  };
}

export function measurementToRectBounds(rect: MeasurementRect): RectBounds {
  return {
    x: rect.rectX,
    y: rect.rectY,
    width: rect.rectWidth,
    height: rect.rectHeight,
  };
}

export function buildRectPolygonPoints(rect: RectBounds): ImagePoint[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

export function getLineLength(line: Pick<LineDraft, 'startX' | 'startY' | 'endX' | 'endY'>) {
  return Math.hypot(line.endX - line.startX, line.endY - line.startY);
}

export function clampPointToRect(point: ImagePoint, rect: RectBounds): ImagePoint {
  return {
    x: Math.max(rect.x, Math.min(rect.x + rect.width, point.x)),
    y: Math.max(rect.y, Math.min(rect.y + rect.height, point.y)),
  };
}

export function pointInRect(point: ImagePoint, rect: RectBounds): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}
