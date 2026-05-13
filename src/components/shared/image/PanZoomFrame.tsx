import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../../../lib/api';
import { useImages } from '../../../hooks';

const MIN_SCALE = 1;
const MAX_SCALE = 6;

type PlanEntityType = 'item_plan' | 'proposal_plan';

type Props = {
  entityType: PlanEntityType;
  entityId: string;
  alt: string;
};

export function PanZoomFrame({ entityType, entityId, alt }: Props) {
  const images = useImages(entityType, entityId);
  const primaryImage = images.data?.find((img) => img.isPrimary) ?? images.data?.[0] ?? null;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!primaryImage) return undefined;
    let ignore = false;
    let objectUrl: string | null = null;
    void api.images
      .getContentBlob(primaryImage.id)
      .then((blob) => {
        if (ignore) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      ignore = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [primaryImage]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const clampOffset = useCallback((s: number, ox: number, oy: number) => {
    const el = containerRef.current;
    if (!el) return { x: ox, y: oy };
    const { width, height } = el.getBoundingClientRect();
    const maxX = (width * (s - 1)) / 2;
    const maxY = (height * (s - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) };
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Use a native (non-passive) wheel listener so preventDefault() stops page scroll.
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  scaleRef.current = scale;
  offsetRef.current = offset;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;
      const prev = scaleRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * factor));
      const ratio = next / prev;
      const newX = cursorX + (offsetRef.current.x - cursorX) * ratio;
      const newY = cursorY + (offsetRef.current.y - cursorY) * ratio;
      setScale(next);
      setOffset(clampOffset(next, newX, newY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampOffset]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    setOffset(clampOffset(scale, dragStart.current.ox + dx, dragStart.current.oy + dy));
  };

  const handlePointerUp = () => {
    dragStart.current = null;
  };

  const isZoomed = scale > 1.01;

  // The container div always renders so containerRef is valid when the wheel effect runs.
  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[117/75] overflow-hidden rounded-lg border border-gray-200 bg-surface-muted select-none"
      style={{ cursor: url ? (isZoomed ? 'grab' : 'zoom-in') : 'default' }}
      onPointerDown={url ? handlePointerDown : undefined}
      onPointerMove={url ? handlePointerMove : undefined}
      onPointerUp={url ? handlePointerUp : undefined}
      onPointerCancel={url ? handlePointerUp : undefined}
      onDoubleClick={url ? reset : undefined}
    >
      {images.isLoading && <div className="absolute inset-0 animate-pulse bg-surface-muted" />}
      {!images.isLoading && !url && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
          No plan image
        </div>
      )}
      {url && (
        <>
          <img
            src={url}
            alt={alt}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: dragStart.current ? 'none' : 'transform 0.05s ease-out',
            }}
          />
          {isZoomed && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="absolute bottom-2 right-2 rounded-md bg-white/80 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white"
              title="Reset view (or double-click)"
            >
              Reset
            </button>
          )}
          <div className="absolute top-2 right-2 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-400 pointer-events-none backdrop-blur-sm">
            {isZoomed ? `${Math.round(scale * 100)}%` : 'Scroll to zoom'}
          </div>
        </>
      )}
    </div>
  );
}
