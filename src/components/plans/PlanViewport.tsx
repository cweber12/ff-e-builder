import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { api } from '../../lib/api';
import {
  buildRectPolygonPoints,
  formatDisplayNumber,
  formatPlanLength,
  getLineLength,
  measurementToRectBounds,
  normalizeRectDraft,
  pointInRect,
  type ImagePoint,
  type LineDraft,
  type RectDraft,
} from '../../lib/plans';
import type { LengthLine, Measurement, MeasuredPlan, PlanCalibration } from '../../types';
import { LineOverlay, RectOverlay } from './overlays';
import type { PlanToolId } from './types';

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
  onMeasurementSelect,
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
  onMeasurementSelect: (measurementId: string) => void;
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
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  zoomRef.current = zoom;
  offsetRef.current = offset;
  const selectedMeasurement =
    measurements.find((candidate) => candidate.id === selectedMeasurementId) ?? null;
  const selectedMeasurementRect = selectedMeasurement
    ? measurementToRectBounds(selectedMeasurement)
    : null;
  const hasDrawingCursor =
    imageUrl !== null &&
    (activeTool === 'calibrate' ||
      activeTool === 'length' ||
      activeTool === 'rectangle' ||
      (activeTool === 'crop' && selectedMeasurement !== null));

  const isInputLikeElement = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
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
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = Math.max(1, Math.min(5, previousZoom * factor));
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

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageUrl || event.button !== 0) return;
    updateCrosshairFromEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsInteracting(true);
    pointerStart.current = { clientX: event.clientX, clientY: event.clientY };
    movedSincePointerDown.current = false;

    const canPan = activeTool === 'pan' || isSpacePressed;
    if (canPan) {
      panDragStart.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
      setIsPanning(true);
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
      } else if (selectedMeasurement) {
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

    if (shapeStart.current) {
      const point = imagePointFromClient(event.clientX, event.clientY, true);
      if (!point) return;

      if (activeTool === 'calibrate') {
        onCalibrationDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'length') {
        onLengthLineDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'rectangle') {
        onMeasurementDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: point.x,
          endY: point.y,
        });
      } else if (activeTool === 'crop' && selectedMeasurement) {
        onCropDraftChange({
          startX: shapeStart.current.x,
          startY: shapeStart.current.y,
          endX: point.x,
          endY: point.y,
        });
      }
      return;
    }

    if (!panDragStart.current) return;
    const deltaX = event.clientX - panDragStart.current.px;
    const deltaY = event.clientY - panDragStart.current.py;
    setOffset(
      clampOffset(zoom, panDragStart.current.ox + deltaX, panDragStart.current.oy + deltaY),
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const shouldAttemptSelect =
      !shapeStart.current && !movedSincePointerDown.current && !isSpacePressed && imageUrl;

    if (shouldAttemptSelect) {
      const point = imagePointFromClient(event.clientX, event.clientY);
      if (point) {
        for (let index = measurements.length - 1; index >= 0; index -= 1) {
          const measurement = measurements[index];
          if (measurement && pointInRect(point, measurementToRectBounds(measurement))) {
            onMeasurementSelect(measurement.id);
            break;
          }
        }
      }
    }

    panDragStart.current = null;
    pointerStart.current = null;
    movedSincePointerDown.current = false;
    shapeStart.current = null;
    setIsInteracting(false);
    setIsPanning(false);
  };

  const handlePointerCancel = () => {
    panDragStart.current = null;
    pointerStart.current = null;
    movedSincePointerDown.current = false;
    shapeStart.current = null;
    setCrosshairPoint(null);
    setIsInteracting(false);
    setIsPanning(false);
  };

  const handlePointerLeave = () => {
    if (!pointerStart.current) setCrosshairPoint(null);
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

  return (
    <div className="h-full min-h-0">
      <div
        ref={containerRef}
        className="relative h-full overflow-hidden bg-[#e3ded2]"
        style={{
          cursor: imageUrl
            ? activeTool === 'calibrate' ||
              activeTool === 'length' ||
              activeTool === 'rectangle' ||
              (activeTool === 'crop' && selectedMeasurementRect !== null)
              ? 'none'
              : activeTool === 'pan' || isSpacePressed
                ? isPanning
                  ? 'grabbing'
                  : 'grab'
                : 'default'
            : 'default',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={resetView}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0))]" />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 text-sm text-neutral-500 backdrop-blur">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Loading measured plan…
            </div>
          </div>
        ) : null}

        {!loading && !imageUrl ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm leading-6 text-neutral-500">
            The protected source image could not be loaded for this Measured Plan.
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
              }}
            />

            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {calibration ? (
                <LineOverlay
                  start={viewportPointFromImage({ x: calibration.startX, y: calibration.startY })}
                  end={viewportPointFromImage({ x: calibration.endX, y: calibration.endY })}
                  strokeClassName="stroke-emerald-500"
                  dotClassName="fill-emerald-500"
                  cap="tick"
                />
              ) : null}

              {lengthLines.map((line) => (
                <LineOverlay
                  key={line.id}
                  start={viewportPointFromImage({ x: line.startX, y: line.startY })}
                  end={viewportPointFromImage({ x: line.endX, y: line.endY })}
                  strokeClassName={
                    line.id === selectedLengthLineId ? 'stroke-brand-700' : 'stroke-[#8b6f47]'
                  }
                  dotClassName={
                    line.id === selectedLengthLineId ? 'fill-brand-700' : 'fill-[#8b6f47]'
                  }
                  label={line.label?.trim() || undefined}
                />
              ))}

              {measurements.map((measurement) => (
                <g key={measurement.id}>
                  <RectOverlay
                    points={buildRectPolygonPoints(measurementToRectBounds(measurement)).map(
                      viewportPointFromImage,
                    )}
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
                      fill="rgba(16, 185, 129, 0.08)"
                      stroke={measurement.id === selectedMeasurementId ? '#059669' : '#10b981'}
                      strokeWidth={measurement.id === selectedMeasurementId ? 3 : 2}
                    />
                  ) : null}
                </g>
              ))}

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
                  strokeClassName="stroke-[#c17a00]"
                  dotClassName="fill-[#c17a00]"
                  dashed
                  label="Draft"
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
                  fill="rgba(16, 185, 129, 0.12)"
                  stroke="#059669"
                  strokeWidth={3}
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
                    className="absolute rounded-full border border-white/60 bg-neutral-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm backdrop-blur"
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

            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 backdrop-blur">
              {activeTool === 'calibrate'
                ? 'Draw calibration line'
                : activeTool === 'length'
                  ? 'Draw measured line'
                  : activeTool === 'rectangle'
                    ? 'Draw measured area'
                    : activeTool === 'crop'
                      ? selectedMeasurement
                        ? 'Draw item image crop'
                        : 'Select a measured item'
                      : 'Drag to pan'}
            </div>

            <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1.5">
              <button
                type="button"
                title="Zoom in"
                onClick={() => setZoom((current) => Math.min(5, current * 1.15))}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="zoom-in" />
              </button>
              <button
                type="button"
                title="Zoom out"
                onClick={() => {
                  setZoom((current) => {
                    const nextZoom = Math.max(1, current / 1.15);
                    setOffset((currentOffset) =>
                      clampOffset(nextZoom, currentOffset.x, currentOffset.y),
                    );
                    return nextZoom;
                  });
                }}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="zoom-out" />
              </button>
              <button
                type="button"
                title="Rotate 90°"
                onClick={rotateClockwise}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
              >
                <ViewControlIcon type="rotate" />
              </button>
              {showReset ? (
                <button
                  type="button"
                  title="Reset view"
                  onClick={resetView}
                  className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-brand-700"
                >
                  <ViewControlIcon type="reset" />
                </button>
              ) : null}
            </div>

            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 backdrop-blur">
              <span>{Math.round(zoom * 100)}%</span>
              {rotation !== 0 ? <span>{rotation}°</span> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
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

    return formatPlanLength(pixelLength / calibration.pixelsPerUnit, calibration.unit);
  }

  if (activeTool === 'rectangle' && measurementDraft) {
    const rect = normalizeRectDraft(measurementDraft);
    if (!calibration) {
      return `${formatDisplayNumber(rect.width)} x ${formatDisplayNumber(rect.height)} px`;
    }

    return `${formatPlanLength(rect.width / calibration.pixelsPerUnit, calibration.unit)} x ${formatPlanLength(rect.height / calibration.pixelsPerUnit, calibration.unit)}`;
  }

  if (activeTool === 'crop' && cropDraft) {
    const rect = normalizeRectDraft(cropDraft);
    if (!calibration) {
      return `${formatDisplayNumber(rect.width)} x ${formatDisplayNumber(rect.height)} px`;
    }

    return `${formatPlanLength(rect.width / calibration.pixelsPerUnit, calibration.unit)} x ${formatPlanLength(rect.height / calibration.pixelsPerUnit, calibration.unit)}`;
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
