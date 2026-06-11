import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { api } from '../../../lib/api';
import {
  buildRectPolygonPoints,
  formatAreaUnit,
  formatDisplayNumber,
  formatPlanLengthCompact,
  getLineLength,
  measurementToRectBounds,
  normalizeRectDraft,
  pointInRect,
  type ImagePoint,
  type LineDraft,
  type RectBounds,
  type RectDraft,
} from '../../../lib/plans';
import type { LengthLine, Measurement, MeasuredPlan, PlanCalibration } from '../../../types';
import { LineOverlay, RectOverlay } from './PlanOverlays';
import type { PlanToolId } from './types';

const MAX_ZOOM = 12;
const ZOOM_STEP = 1.16;
const RESIZE_HANDLE_VIEWPORT_RADIUS = 16;
const MIN_RESIZE_RECT_SIZE = 2;

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

type ResizeDragState = {
  measurement: Measurement;
  handle: ResizeHandle;
  initialRect: RectBounds;
};

export function PlanViewport({
  projectId,
  plan,
  activeTool,
  calibration,
  calibrationDraft,
  onCalibrationDraftChange,
  lengthLines,
  selectedLengthLineId,
  lengthLineDraft,
  onLengthLineDraftChange,
  measurements,
  selectedMeasurementId,
  measurementDraft,
  onMeasurementDraftChange,
  cropDraft,
  onCropDraftChange,
  highlightRectOverlay,
  highlightCropPending,
  onMeasurementSelect,
  onMeasurementResize,
  onNaturalSizeChange,
}: {
  projectId: string;
  plan: MeasuredPlan;
  activeTool: PlanToolId;
  calibration: PlanCalibration | null | undefined;
  calibrationDraft: LineDraft | null;
  onCalibrationDraftChange: (draft: LineDraft | null) => void;
  lengthLines: LengthLine[];
  selectedLengthLineId: string | null;
  lengthLineDraft: LineDraft | null;
  onLengthLineDraftChange: (draft: LineDraft | null) => void;
  measurements: Measurement[];
  selectedMeasurementId: string | null;
  measurementDraft: RectDraft | null;
  onMeasurementDraftChange: (draft: RectDraft | null) => void;
  cropDraft: RectDraft | null;
  onCropDraftChange: (draft: RectDraft | null) => void;
  highlightRectOverlay: RectBounds | null;
  highlightCropPending: boolean;
  onMeasurementSelect: (measurementId: string) => void;
  onMeasurementResize: (measurement: Measurement, rect: RectBounds) => void | Promise<void>;
  onNaturalSizeChange: (size: { width: number; height: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [crosshairPoint, setCrosshairPoint] = useState<ImagePoint | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const panDragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const pointerStart = useRef<{ clientX: number; clientY: number } | null>(null);
  const movedSincePointerDown = useRef(false);
  const shapeStart = useRef<ImagePoint | null>(null);
  const resizeDragStart = useRef<ResizeDragState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingFrameAction = useRef<(() => void) | null>(null);
  const [resizingMeasurement, setResizingMeasurement] = useState<{
    measurementId: string;
    rect: RectBounds;
  } | null>(null);
  const [hoverResizeHandle, setHoverResizeHandle] = useState<ResizeHandle | null>(null);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  zoomRef.current = zoom;
  offsetRef.current = offset;
  const selectedMeasurement =
    measurements.find((candidate) => candidate.id === selectedMeasurementId) ?? null;
  const selectedMeasurementRect = selectedMeasurement
    ? measurementToRectBounds(selectedMeasurement)
    : null;
  const selectedDisplayRect =
    selectedMeasurement && resizingMeasurement?.measurementId === selectedMeasurement.id
      ? resizingMeasurement.rect
      : selectedMeasurementRect;
  const hasDrawingCursor =
    imageUrl !== null &&
    (activeTool === 'calibrate' ||
      activeTool === 'length' ||
      activeTool === 'rectangle' ||
      (activeTool === 'crop' && (selectedMeasurement !== null || highlightCropPending)));

  const isInputLikeElement = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }, []);

  const runOnNextFrame = useCallback((action: () => void) => {
    pendingFrameAction.current = action;
    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const nextAction = pendingFrameAction.current;
      pendingFrameAction.current = null;
      nextAction?.();
    });
  }, []);

  const runImmediately = useCallback((action: () => void) => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    pendingFrameAction.current = null;
    action();
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isInputLikeElement(event.target)) return;
      event.preventDefault();
      setIsSpacePressed(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setIsSpacePressed(false);
      if (activeTool !== 'pan') {
        panDragStart.current = null;
        setIsPanning(false);
      }
    };

    const onWindowBlur = () => {
      setIsSpacePressed(false);
      if (activeTool !== 'pan') {
        panDragStart.current = null;
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [activeTool, isInputLikeElement]);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    async function loadImage() {
      setLoading(true);
      setImageUrl(null);
      setNaturalSize({ width: 0, height: 0 });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setRotation(0);
      try {
        const blob = await api.plans.downloadContent(projectId, plan.id);
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch {
        if (!disposed) setImageUrl(null);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void loadImage();

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [plan.id, projectId]);

  useEffect(() => {
    onNaturalSizeChange(naturalSize);
  }, [naturalSize, onNaturalSizeChange]);

  useEffect(() => {
    if (!resizingMeasurement) return;
    if (!selectedMeasurement || resizingMeasurement.measurementId !== selectedMeasurement.id) {
      setResizingMeasurement(null);
      return;
    }

    const selectedRect = measurementToRectBounds(selectedMeasurement);
    if (rectsEqual(selectedRect, resizingMeasurement.rect)) {
      setResizingMeasurement(null);
    }
  }, [resizingMeasurement, selectedMeasurement]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver !== 'function') return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      const height = entry?.contentRect.height ?? 0;
      setContainerSize({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rotatedSize = useMemo(() => {
    const quarterTurns = ((rotation % 360) + 360) % 360;
    const swap = quarterTurns === 90 || quarterTurns === 270;
    return swap
      ? { width: naturalSize.height, height: naturalSize.width }
      : { width: naturalSize.width, height: naturalSize.height };
  }, [naturalSize.height, naturalSize.width, rotation]);

  const fitScale = useMemo(() => {
    if (
      naturalSize.width <= 0 ||
      naturalSize.height <= 0 ||
      containerSize.width <= 0 ||
      containerSize.height <= 0
    ) {
      return 1;
    }

    return Math.min(
      containerSize.width / Math.max(rotatedSize.width, 1),
      containerSize.height / Math.max(rotatedSize.height, 1),
    );
  }, [
    containerSize.height,
    containerSize.width,
    naturalSize.height,
    naturalSize.width,
    rotatedSize.height,
    rotatedSize.width,
  ]);

  const effectiveScale = fitScale * zoom;

  const clampOffset = useCallback(
    (nextZoom: number, nextOffsetX: number, nextOffsetY: number) => {
      const width = rotatedSize.width * fitScale * nextZoom;
      const height = rotatedSize.height * fitScale * nextZoom;
      const maxX = Math.max(0, (width - containerSize.width) / 2);
      const maxY = Math.max(0, (height - containerSize.height) / 2);

      return {
        x: Math.max(-maxX, Math.min(maxX, nextOffsetX)),
        y: Math.max(-maxY, Math.min(maxY, nextOffsetY)),
      };
    },
    [containerSize.height, containerSize.width, fitScale, rotatedSize.height, rotatedSize.width],
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const updateCrosshairFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!hasDrawingCursor) {
        setCrosshairPoint(null);
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      setCrosshairPoint({
        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
      });
    },
    [hasDrawingCursor],
  );

  const rotateClockwise = useCallback(() => {
    setRotation((current) => (current + 90) % 360);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const imagePointFromClient = useCallback(
    (clientX: number, clientY: number, clamp = false): ImagePoint | null => {
      const element = containerRef.current;
      if (!element || naturalSize.width <= 0 || naturalSize.height <= 0 || effectiveScale <= 0) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const centeredX = clientX - rect.left - rect.width / 2 - offset.x;
      const centeredY = clientY - rect.top - rect.height / 2 - offset.y;
      const radians = (-rotation * Math.PI) / 180;
      const unrotatedX = centeredX * Math.cos(radians) - centeredY * Math.sin(radians);
      const unrotatedY = centeredX * Math.sin(radians) + centeredY * Math.cos(radians);
      const imageX = unrotatedX / effectiveScale + naturalSize.width / 2;
      const imageY = unrotatedY / effectiveScale + naturalSize.height / 2;

      if (!clamp) {
        if (imageX < 0 || imageX > naturalSize.width || imageY < 0 || imageY > naturalSize.height) {
          return null;
        }
        return { x: imageX, y: imageY };
      }

      return {
        x: Math.max(0, Math.min(naturalSize.width, imageX)),
        y: Math.max(0, Math.min(naturalSize.height, imageY)),
      };
    },
    [effectiveScale, naturalSize.height, naturalSize.width, offset.x, offset.y, rotation],
  );

  const viewportPointFromImage = useCallback(
    (point: ImagePoint): ImagePoint => {
      const centeredX = (point.x - naturalSize.width / 2) * effectiveScale;
      const centeredY = (point.y - naturalSize.height / 2) * effectiveScale;
      const radians = (rotation * Math.PI) / 180;
      const rotatedX = centeredX * Math.cos(radians) - centeredY * Math.sin(radians);
      const rotatedY = centeredX * Math.sin(radians) + centeredY * Math.cos(radians);
      return {
        x: containerSize.width / 2 + offset.x + rotatedX,
        y: containerSize.height / 2 + offset.y + rotatedY,
      };
    },
    [
      containerSize.height,
      containerSize.width,
      effectiveScale,
      naturalSize.height,
      naturalSize.width,
      offset.x,
      offset.y,
      rotation,
    ],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const onWheel = (event: WheelEvent) => {
      if (!imageUrl) return;
      event.preventDefault();
      setIsInteracting(true);

      const rect = element.getBoundingClientRect();
      const cursorX = event.clientX - rect.left - rect.width / 2;
      const cursorY = event.clientY - rect.top - rect.height / 2;
      const previousZoom = zoomRef.current;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nextZoom = Math.max(1, Math.min(MAX_ZOOM, previousZoom * factor));
      const ratio = nextZoom / previousZoom;
      const nextOffsetX = cursorX + (offsetRef.current.x - cursorX) * ratio;
      const nextOffsetY = cursorY + (offsetRef.current.y - cursorY) * ratio;

      setZoom(nextZoom);
      setOffset(clampOffset(nextZoom, nextOffsetX, nextOffsetY));
      window.clearTimeout((onWheel as typeof onWheel & { timeout?: number }).timeout);
      (onWheel as typeof onWheel & { timeout?: number }).timeout = window.setTimeout(() => {
        setIsInteracting(false);
      }, 80);
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [clampOffset, imageUrl]);

  const updateShapeDraft = useCallback(
    (point: ImagePoint, immediate = false) => {
      if (!shapeStart.current) return;

      const start = shapeStart.current;
      const action = () => {
        if (activeTool === 'calibrate') {
          onCalibrationDraftChange({
            startX: start.x,
            startY: start.y,
            endX: point.x,
            endY: point.y,
          });
        } else if (activeTool === 'length') {
          onLengthLineDraftChange({
            startX: start.x,
            startY: start.y,
            endX: point.x,
            endY: point.y,
          });
        } else if (activeTool === 'rectangle') {
          onMeasurementDraftChange({
            startX: start.x,
            startY: start.y,
            endX: point.x,
            endY: point.y,
          });
        } else if (activeTool === 'crop' && (selectedMeasurement || highlightCropPending)) {
          onCropDraftChange({
            startX: start.x,
            startY: start.y,
            endX: point.x,
            endY: point.y,
          });
        }
      };

      if (immediate) {
        runImmediately(action);
      } else {
        runOnNextFrame(action);
      }
    },
    [
      activeTool,
      highlightCropPending,
      onCalibrationDraftChange,
      onCropDraftChange,
      onLengthLineDraftChange,
      onMeasurementDraftChange,
      runImmediately,
      runOnNextFrame,
      selectedMeasurement,
    ],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageUrl || !isPrimaryPointerButton(event.button)) return;
    updateCrosshairFromEvent(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsInteracting(true);
    pointerStart.current = { clientX: event.clientX, clientY: event.clientY };
    movedSincePointerDown.current = false;

    const canPan = activeTool === 'pan' || isSpacePressed;
    if (canPan) {
      panDragStart.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
      setIsPanning(true);
      return;
    }

    if (activeTool === 'select') {
      const point = imagePointFromClient(event.clientX, event.clientY);
      if (!point) return;

      if (selectedMeasurement && selectedDisplayRect) {
        const handle = getResizeHandleAtPoint(
          point,
          selectedDisplayRect,
          RESIZE_HANDLE_VIEWPORT_RADIUS / effectiveScale,
        );
        if (handle) {
          resizeDragStart.current = {
            measurement: selectedMeasurement,
            handle,
            initialRect: selectedDisplayRect,
          };
          setHoverResizeHandle(handle);
          setResizingMeasurement({
            measurementId: selectedMeasurement.id,
            rect: selectedDisplayRect,
          });
          return;
        }
      }

      const measurement = findTopmostMeasurementAtPoint(point, measurements);
      if (measurement) {
        onMeasurementSelect(measurement.id);
        setHoverResizeHandle(null);
      }
      return;
    }

    if (
      activeTool === 'calibrate' ||
      activeTool === 'length' ||
      activeTool === 'rectangle' ||
      activeTool === 'crop'
    ) {
      const point = imagePointFromClient(event.clientX, event.clientY);
      if (!point) return;

      if (activeTool === 'calibrate') {
        shapeStart.current = point;
        onCalibrationDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'length') {
        shapeStart.current = point;
        onLengthLineDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'rectangle') {
        shapeStart.current = point;
        onMeasurementDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (selectedMeasurement || highlightCropPending) {
        shapeStart.current = point;
        onCropDraftChange({
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        });
      }
      return;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateCrosshairFromEvent(event);

    if (pointerStart.current) {
      const deltaX = event.clientX - pointerStart.current.clientX;
      const deltaY = event.clientY - pointerStart.current.clientY;
      if (Math.hypot(deltaX, deltaY) >= 3) {
        movedSincePointerDown.current = true;
      }
    }

    if (resizeDragStart.current) {
      const point = imagePointFromClient(event.clientX, event.clientY, true);
      if (!point) return;

      const nextRect = resizeRectFromHandle(
        resizeDragStart.current.initialRect,
        resizeDragStart.current.handle,
        point,
        naturalSize,
      );
      const measurementId = resizeDragStart.current.measurement.id;
      runOnNextFrame(() =>
        setResizingMeasurement({
          measurementId,
          rect: nextRect,
        }),
      );
      return;
    }

    if (shapeStart.current) {
      const point = imagePointFromClient(event.clientX, event.clientY, true);
      if (!point) return;

      updateShapeDraft(point);
      return;
    }

    if (activeTool === 'select' && selectedMeasurementRect) {
      const point = imagePointFromClient(event.clientX, event.clientY);
      setHoverResizeHandle(
        point
          ? getResizeHandleAtPoint(
              point,
              selectedMeasurementRect,
              RESIZE_HANDLE_VIEWPORT_RADIUS / effectiveScale,
            )
          : null,
      );
    }

    if (!panDragStart.current) return;
    const deltaX = event.clientX - panDragStart.current.px;
    const deltaY = event.clientY - panDragStart.current.py;
    const nextOffset = clampOffset(
      zoom,
      panDragStart.current.ox + deltaX,
      panDragStart.current.oy + deltaY,
    );
    runOnNextFrame(() => setOffset(nextOffset));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wasResizing = resizeDragStart.current !== null;

    if (resizeDragStart.current) {
      const point = imagePointFromClient(event.clientX, event.clientY, true);
      if (point) {
        const nextRect = resizeRectFromHandle(
          resizeDragStart.current.initialRect,
          resizeDragStart.current.handle,
          point,
          naturalSize,
        );
        const measurement = resizeDragStart.current.measurement;
        if (rectsEqual(nextRect, resizeDragStart.current.initialRect)) {
          runImmediately(() => setResizingMeasurement(null));
        } else {
          runImmediately(() =>
            setResizingMeasurement({ measurementId: measurement.id, rect: nextRect }),
          );
          void onMeasurementResize(measurement, nextRect);
        }
      }
    } else if (shapeStart.current) {
      const point = imagePointFromClient(event.clientX, event.clientY, true);
      if (point) updateShapeDraft(point, true);
    }

    const shouldAttemptSelect =
      !wasResizing &&
      !shapeStart.current &&
      !movedSincePointerDown.current &&
      !isSpacePressed &&
      imageUrl;

    if (shouldAttemptSelect) {
      const point = imagePointFromClient(event.clientX, event.clientY);
      if (point) {
        const measurement = findTopmostMeasurementAtPoint(point, measurements);
        if (measurement) onMeasurementSelect(measurement.id);
      }
    }

    panDragStart.current = null;
    pointerStart.current = null;
    movedSincePointerDown.current = false;
    shapeStart.current = null;
    resizeDragStart.current = null;
    setIsInteracting(false);
    setIsPanning(false);
  };

  const handlePointerCancel = () => {
    panDragStart.current = null;
    pointerStart.current = null;
    movedSincePointerDown.current = false;
    shapeStart.current = null;
    resizeDragStart.current = null;
    setResizingMeasurement(null);
    setHoverResizeHandle(null);
    setCrosshairPoint(null);
    setIsInteracting(false);
    setIsPanning(false);
  };

  const handlePointerLeave = () => {
    if (!pointerStart.current) setCrosshairPoint(null);
    if (!pointerStart.current) setHoverResizeHandle(null);
  };

  const showReset = zoom > 1.01 || rotation !== 0 || offset.x !== 0 || offset.y !== 0;
  const draftMeasurementRect = measurementDraft ? normalizeRectDraft(measurementDraft) : null;
  const draftCropRect = cropDraft ? normalizeRectDraft(cropDraft) : null;
  const liveMeasurementLabel = getLiveMeasurementLabel({
    activeTool,
    calibration,
    calibrationDraft,
    lengthLineDraft,
    measurementDraft,
    cropDraft,
  });
  const liveMeasurementPosition =
    crosshairPoint && liveMeasurementLabel
      ? {
          x: Math.max(12, Math.min(containerSize.width - 220, crosshairPoint.x + 14)),
          y: Math.max(12, Math.min(containerSize.height - 48, crosshairPoint.y + 14)),
        }
      : null;
  const cursor = getViewportCursor({
    activeTool,
    hasImage: imageUrl !== null,
    hoverResizeHandle,
    isPanning,
    isSpacePressed,
    selectedMeasurementRect: selectedDisplayRect,
  });

  return (
    <div className="h-full min-h-0">
      <div
        ref={containerRef}
        data-testid="plan-viewport-canvas"
        className="paper-texture relative h-full overflow-hidden"
        style={{ cursor, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={resetView}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0))]" />
        {loading ? (
          <div className="canvas-hatch absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white/85 px-4 py-2 text-sm text-neutral-600 shadow-sm backdrop-blur">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <span className="num-muted">Loading measured plan…</span>
            </div>
          </div>
        ) : null}

        {!loading && !imageUrl ? (
          <div className="canvas-hatch absolute inset-0 flex items-center justify-center px-6 text-center">
            <div className="max-w-sm rounded-2xl border border-dashed border-neutral-300 bg-white/70 px-6 py-8 shadow-sm">
              <p className="font-display text-base font-semibold text-neutral-900">
                Plan image unavailable
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                The protected source image could not be loaded for this Measured Plan.
              </p>
            </div>
          </div>
        ) : null}

        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={plan.name}
              draggable={false}
              onLoad={(event) =>
                setNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              className="pointer-events-none absolute left-1/2 top-1/2 select-none"
              style={{
                width: naturalSize.width || undefined,
                height: 'auto',
                maxWidth: 'none',
                maxHeight: 'none',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${effectiveScale})`,
                transformOrigin: 'center center',
                transition: isInteracting ? 'none' : 'transform 0.08s ease-out',
                willChange: 'transform',
              }}
            />

            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {calibration ? (
                <LineOverlay
                  start={viewportPointFromImage({ x: calibration.startX, y: calibration.startY })}
                  end={viewportPointFromImage({ x: calibration.endX, y: calibration.endY })}
                  strokeClassName="stroke-brand-600"
                  dotClassName="fill-brand-600"
                  cap="tick"
                />
              ) : null}

              {lengthLines.map((line) => (
                <LineOverlay
                  key={line.id}
                  start={viewportPointFromImage({ x: line.startX, y: line.startY })}
                  end={viewportPointFromImage({ x: line.endX, y: line.endY })}
                  strokeClassName={
                    line.id === selectedLengthLineId ? 'stroke-brand-700' : 'stroke-plan-line'
                  }
                  dotClassName={
                    line.id === selectedLengthLineId ? 'fill-brand-700' : 'fill-plan-line'
                  }
                  label={line.label?.trim() || undefined}
                />
              ))}

              {measurements.map((measurement) => (
                <g key={measurement.id}>
                  <RectOverlay
                    points={buildRectPolygonPoints(
                      resizingMeasurement?.measurementId === measurement.id
                        ? resizingMeasurement.rect
                        : measurementToRectBounds(measurement),
                    ).map(viewportPointFromImage)}
                    active={measurement.id === selectedMeasurementId}
                  />
                  {measurement.cropX !== null &&
                  measurement.cropY !== null &&
                  measurement.cropWidth !== null &&
                  measurement.cropHeight !== null ? (
                    <RectOverlay
                      points={buildRectPolygonPoints({
                        x: measurement.cropX,
                        y: measurement.cropY,
                        width: measurement.cropWidth,
                        height: measurement.cropHeight,
                      }).map(viewportPointFromImage)}
                      active={measurement.id === selectedMeasurementId}
                      dashed
                      fill="rgba(5, 150, 105, 0.06)"
                      stroke={measurement.id === selectedMeasurementId ? '#047857' : '#059669'}
                      strokeWidth={measurement.id === selectedMeasurementId ? 1.75 : 1.25}
                    />
                  ) : null}
                </g>
              ))}

              {activeTool === 'select' && selectedDisplayRect ? (
                <ResizeHandles
                  rect={selectedDisplayRect}
                  viewportPointFromImage={viewportPointFromImage}
                  activeHandle={hoverResizeHandle}
                />
              ) : null}

              {calibrationDraft ? (
                <LineOverlay
                  start={viewportPointFromImage({
                    x: calibrationDraft.startX,
                    y: calibrationDraft.startY,
                  })}
                  end={viewportPointFromImage({
                    x: calibrationDraft.endX,
                    y: calibrationDraft.endY,
                  })}
                  strokeClassName="stroke-brand-600"
                  dotClassName="fill-brand-600"
                  cap="tick"
                  dashed
                />
              ) : null}

              {lengthLineDraft ? (
                <LineOverlay
                  start={viewportPointFromImage({
                    x: lengthLineDraft.startX,
                    y: lengthLineDraft.startY,
                  })}
                  end={viewportPointFromImage({ x: lengthLineDraft.endX, y: lengthLineDraft.endY })}
                  strokeClassName="stroke-plan-measure"
                  dotClassName="fill-plan-measure"
                  dashed
                  label="Draft"
                />
              ) : null}

              {highlightRectOverlay ? (
                <RectOverlay
                  points={buildRectPolygonPoints(highlightRectOverlay).map(viewportPointFromImage)}
                  active
                />
              ) : null}

              {draftMeasurementRect ? (
                <RectOverlay
                  points={buildRectPolygonPoints(draftMeasurementRect).map(viewportPointFromImage)}
                  active
                  dashed
                />
              ) : null}

              {draftCropRect ? (
                <RectOverlay
                  points={buildRectPolygonPoints(draftCropRect).map(viewportPointFromImage)}
                  active
                  dashed
                  fill="rgba(5, 150, 105, 0.08)"
                  stroke="#047857"
                  strokeWidth={1.75}
                />
              ) : null}
            </svg>

            {hasDrawingCursor && crosshairPoint ? (
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute top-0 h-full w-px bg-neutral-950/35"
                  style={{ left: crosshairPoint.x }}
                />
                <div
                  className="absolute left-0 h-px w-full bg-neutral-950/35"
                  style={{ top: crosshairPoint.y }}
                />
                {liveMeasurementPosition && liveMeasurementLabel ? (
                  <div
                    className="absolute whitespace-nowrap rounded-md border border-white/30 bg-neutral-950/85 px-2 py-0.5 text-[12px] font-semibold leading-tight tracking-tight text-white tabular-nums shadow-md backdrop-blur"
                    style={{
                      left: liveMeasurementPosition.x,
                      top: liveMeasurementPosition.y,
                    }}
                  >
                    {liveMeasurementLabel}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600 shadow-sm backdrop-blur">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              {activeTool === 'calibrate'
                ? 'Draw calibration line'
                : activeTool === 'select'
                  ? 'Select or resize measured area'
                  : activeTool === 'length'
                    ? 'Draw measured line'
                    : activeTool === 'rectangle'
                      ? 'Draw measured area'
                      : activeTool === 'crop'
                        ? selectedMeasurement || highlightCropPending
                          ? 'Draw item image crop'
                          : 'Select a measured item'
                        : 'Drag to pan'}
            </div>

            <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1.5">
              <button
                type="button"
                title="Zoom in"
                onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current * ZOOM_STEP))}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="zoom-in" />
              </button>
              <button
                type="button"
                title="Zoom out"
                onClick={() => {
                  setZoom((current) => {
                    const nextZoom = Math.max(1, current / ZOOM_STEP);
                    setOffset((currentOffset) =>
                      clampOffset(nextZoom, currentOffset.x, currentOffset.y),
                    );
                    return nextZoom;
                  });
                }}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="zoom-out" />
              </button>
              <button
                type="button"
                title="Rotate 90°"
                onClick={rotateClockwise}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="rotate" />
              </button>
              {showReset ? (
                <button
                  type="button"
                  title="Reset view"
                  onClick={resetView}
                  className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
                >
                  <ViewControlIcon type="reset" />
                </button>
              ) : null}
            </div>

            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-md border border-neutral-200 bg-white/85 px-2.5 py-1 shadow-sm backdrop-blur">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Zoom
              </span>
              <span className="num text-[11px] font-semibold text-neutral-900">
                {Math.round(zoom * 100)}%
              </span>
              {rotation !== 0 ? (
                <>
                  <span aria-hidden className="h-3 w-px bg-neutral-300" />
                  <span className="num text-[11px] font-semibold text-neutral-900">
                    {rotation}°
                  </span>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function isPrimaryPointerButton(button: number | undefined) {
  return button === 0 || button === undefined;
}

function ResizeHandles({
  rect,
  viewportPointFromImage,
  activeHandle,
}: {
  rect: RectBounds;
  viewportPointFromImage: (point: ImagePoint) => ImagePoint;
  activeHandle: ResizeHandle | null;
}) {
  return (
    <g>
      {getResizeHandlePoints(rect).map(({ handle, point }) => {
        const viewportPoint = viewportPointFromImage(point);
        const active = handle === activeHandle;

        return (
          <rect
            key={handle}
            x={viewportPoint.x - 4.5}
            y={viewportPoint.y - 4.5}
            width={9}
            height={9}
            rx={2}
            fill={active ? '#0E1622' : '#FFFFFF'}
            stroke="#FFE600"
            strokeWidth={1.75}
          />
        );
      })}
    </g>
  );
}

function getResizeHandlePoints(
  rect: RectBounds,
): Array<{ handle: ResizeHandle; point: ImagePoint }> {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  return [
    { handle: 'nw', point: { x: left, y: top } },
    { handle: 'n', point: { x: centerX, y: top } },
    { handle: 'ne', point: { x: right, y: top } },
    { handle: 'e', point: { x: right, y: centerY } },
    { handle: 'se', point: { x: right, y: bottom } },
    { handle: 's', point: { x: centerX, y: bottom } },
    { handle: 'sw', point: { x: left, y: bottom } },
    { handle: 'w', point: { x: left, y: centerY } },
  ];
}

function getResizeHandleAtPoint(
  point: ImagePoint,
  rect: RectBounds,
  tolerance: number,
): ResizeHandle | null {
  let nearestHandle: ResizeHandle | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const handlePoint of getResizeHandlePoints(rect)) {
    const distance = Math.hypot(point.x - handlePoint.point.x, point.y - handlePoint.point.y);
    if (distance <= tolerance && distance < nearestDistance) {
      nearestHandle = handlePoint.handle;
      nearestDistance = distance;
    }
  }

  if (nearestHandle) return nearestHandle;

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const withinHorizontalSpan = point.x >= left - tolerance && point.x <= right + tolerance;
  const withinVerticalSpan = point.y >= top - tolerance && point.y <= bottom + tolerance;
  const edgeCandidates: Array<{ handle: ResizeHandle; distance: number }> = [];

  if (withinHorizontalSpan) {
    edgeCandidates.push({ handle: 'n', distance: Math.abs(point.y - top) });
    edgeCandidates.push({ handle: 's', distance: Math.abs(point.y - bottom) });
  }
  if (withinVerticalSpan) {
    edgeCandidates.push({ handle: 'w', distance: Math.abs(point.x - left) });
    edgeCandidates.push({ handle: 'e', distance: Math.abs(point.x - right) });
  }

  const nearestEdge = edgeCandidates
    .filter((candidate) => candidate.distance <= tolerance)
    .sort((a, b) => a.distance - b.distance)[0];

  return nearestEdge?.handle ?? null;
}

function findTopmostMeasurementAtPoint(point: ImagePoint, measurements: Measurement[]) {
  for (let index = measurements.length - 1; index >= 0; index -= 1) {
    const measurement = measurements[index];
    if (measurement && pointInRect(point, measurementToRectBounds(measurement))) {
      return measurement;
    }
  }

  return null;
}

function resizeRectFromHandle(
  initialRect: RectBounds,
  handle: ResizeHandle,
  point: ImagePoint,
  naturalSize: { width: number; height: number },
): RectBounds {
  let left = initialRect.x;
  let top = initialRect.y;
  let right = initialRect.x + initialRect.width;
  let bottom = initialRect.y + initialRect.height;
  const clampedPoint = {
    x: Math.max(0, Math.min(naturalSize.width, point.x)),
    y: Math.max(0, Math.min(naturalSize.height, point.y)),
  };

  if (handle.includes('w')) {
    left = Math.min(right - MIN_RESIZE_RECT_SIZE, clampedPoint.x);
  }
  if (handle.includes('e')) {
    right = Math.max(left + MIN_RESIZE_RECT_SIZE, clampedPoint.x);
  }
  if (handle.includes('n')) {
    top = Math.min(bottom - MIN_RESIZE_RECT_SIZE, clampedPoint.y);
  }
  if (handle.includes('s')) {
    bottom = Math.max(top + MIN_RESIZE_RECT_SIZE, clampedPoint.y);
  }

  left = Math.max(0, Math.min(naturalSize.width - MIN_RESIZE_RECT_SIZE, left));
  top = Math.max(0, Math.min(naturalSize.height - MIN_RESIZE_RECT_SIZE, top));
  right = Math.max(left + MIN_RESIZE_RECT_SIZE, Math.min(naturalSize.width, right));
  bottom = Math.max(top + MIN_RESIZE_RECT_SIZE, Math.min(naturalSize.height, bottom));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getViewportCursor({
  activeTool,
  hasImage,
  hoverResizeHandle,
  isPanning,
  isSpacePressed,
  selectedMeasurementRect,
}: {
  activeTool: PlanToolId;
  hasImage: boolean;
  hoverResizeHandle: ResizeHandle | null;
  isPanning: boolean;
  isSpacePressed: boolean;
  selectedMeasurementRect: RectBounds | null;
}) {
  if (!hasImage) return 'default';
  if (activeTool === 'pan' || isSpacePressed) {
    return isPanning ? 'grabbing' : 'grab';
  }
  if (activeTool === 'select') {
    return hoverResizeHandle ? resizeCursorForHandle(hoverResizeHandle) : 'pointer';
  }
  if (
    activeTool === 'calibrate' ||
    activeTool === 'length' ||
    activeTool === 'rectangle' ||
    (activeTool === 'crop' && selectedMeasurementRect !== null)
  ) {
    return 'none';
  }
  return 'default';
}

function resizeCursorForHandle(handle: ResizeHandle) {
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
  return 'nwse-resize';
}

function rectsEqual(a: RectBounds, b: RectBounds) {
  return (
    Math.abs(a.x - b.x) < 0.01 &&
    Math.abs(a.y - b.y) < 0.01 &&
    Math.abs(a.width - b.width) < 0.01 &&
    Math.abs(a.height - b.height) < 0.01
  );
}

function getLiveMeasurementLabel({
  activeTool,
  calibration,
  calibrationDraft,
  lengthLineDraft,
  measurementDraft,
  cropDraft,
}: {
  activeTool: PlanToolId;
  calibration: PlanCalibration | null | undefined;
  calibrationDraft: LineDraft | null;
  lengthLineDraft: LineDraft | null;
  measurementDraft: RectDraft | null;
  cropDraft: RectDraft | null;
}) {
  if (activeTool === 'calibrate' && calibrationDraft) {
    return `${formatDisplayNumber(getLineLength(calibrationDraft))} px`;
  }

  if (activeTool === 'length' && lengthLineDraft) {
    const pixelLength = getLineLength(lengthLineDraft);
    if (!calibration) return `${formatDisplayNumber(pixelLength)} px`;

    return formatPlanLengthCompact(pixelLength / calibration.pixelsPerUnit, calibration.unit);
  }

  if (activeTool === 'rectangle' && measurementDraft) {
    const rect = normalizeRectDraft(measurementDraft);
    if (!calibration) {
      return `${formatDisplayNumber(rect.width)} × ${formatDisplayNumber(rect.height)} px`;
    }

    const width = rect.width / calibration.pixelsPerUnit;
    const height = rect.height / calibration.pixelsPerUnit;
    return `${formatPlanLengthCompact(width, calibration.unit)} × ${formatPlanLengthCompact(height, calibration.unit)}  ·  ${formatDisplayNumber(width * height)} ${formatAreaUnit(calibration.unit)}`;
  }

  if (activeTool === 'crop' && cropDraft) {
    const rect = normalizeRectDraft(cropDraft);
    if (!calibration) {
      return `${formatDisplayNumber(rect.width)} × ${formatDisplayNumber(rect.height)} px`;
    }

    return `${formatPlanLengthCompact(rect.width / calibration.pixelsPerUnit, calibration.unit)} × ${formatPlanLengthCompact(rect.height / calibration.pixelsPerUnit, calibration.unit)}`;
  }

  return null;
}

function ViewControlIcon({ type }: { type: 'zoom-in' | 'zoom-out' | 'rotate' | 'reset' }) {
  return (
    <span className="h-4 w-4">
      {type === 'zoom-in' ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M7 5v4M5 7h4" strokeLinecap="round" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
      ) : type === 'zoom-out' ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M5 7h4" strokeLinecap="round" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
      ) : type === 'rotate' ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12.5 4a6 6 0 1 0 1.3 5" strokeLinecap="round" />
          <path d="M13.5 1.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3V1M8 15v-2M1 8H3M13 8h2" strokeLinecap="round" />
          <circle cx="8" cy="8" r="3" />
        </svg>
      )}
    </span>
  );
}
