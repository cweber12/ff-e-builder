import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ClipboardEvent as ReactClipboardEvent } from 'react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { isPersistedImageEntityId, useImages, useUploadImage } from '../../../hooks';

const MIN_SCALE = 1;
const MAX_SCALE = 6;

type PlanEntityType = 'item_plan' | 'proposal_plan';

type Props = {
  entityType: PlanEntityType;
  entityId: string;
  alt: string;
  editable?: boolean;
};

const accept = 'image/jpeg,image/png,image/webp,image/gif';

export function PanZoomFrame({ entityType, entityId, alt, editable = false }: Props) {
  const images = useImages(entityType, entityId);
  const upload = useUploadImage(entityType, entityId);
  const primaryImage = images.data?.find((img) => img.isPrimary) ?? images.data?.[0] ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const documentPasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);
  const canUpload = editable && isPersistedImageEntityId(entityId) && !upload.isPending;

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

  const handleFile = (file: File | undefined) => {
    if (!file || !canUpload) return;
    setUploadError(null);
    upload.mutate(
      { file, altText: alt },
      {
        onSuccess: () => setUploadError(null),
        onError: (err) => {
          setUploadError(err instanceof Error ? err.message : 'Plan image upload failed');
        },
      },
    );
  };

  const handlePaste = (event: ClipboardEvent | ReactClipboardEvent) => {
    if (!canUpload) return;
    const pastedImage = Array.from(event.clipboardData?.items ?? [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();
    if (!pastedImage) return;
    event.preventDefault();
    handleFile(pastedImage);
  };

  const enablePasteTarget = () => {
    if (!canUpload || documentPasteHandlerRef.current) return;
    const handler = (event: ClipboardEvent) => handlePaste(event);
    documentPasteHandlerRef.current = handler;
    document.addEventListener('paste', handler);
  };

  const disablePasteTarget = () => {
    const handler = documentPasteHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('paste', handler);
    documentPasteHandlerRef.current = null;
  };

  useEffect(
    () => () => {
      const handler = documentPasteHandlerRef.current;
      if (handler) document.removeEventListener('paste', handler);
    },
    [],
  );

  // The container div always renders so containerRef is valid when the wheel effect runs.
  return (
    <div className="grid gap-1">
      <div
        ref={containerRef}
        tabIndex={canUpload ? 0 : undefined}
        onPaste={handlePaste}
        onMouseEnter={enablePasteTarget}
        onMouseLeave={disablePasteTarget}
        onFocus={enablePasteTarget}
        onBlur={disablePasteTarget}
        className={cn(
          'group relative w-full aspect-[117/75] overflow-hidden border border-neutral-200 bg-canvas-shell select-none',
          canUpload &&
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
        )}
        style={{ cursor: url ? (isZoomed ? 'grab' : 'zoom-in') : 'default' }}
        onPointerDown={url ? handlePointerDown : undefined}
        onPointerMove={url ? handlePointerMove : undefined}
        onPointerUp={url ? handlePointerUp : undefined}
        onPointerCancel={url ? handlePointerUp : undefined}
        onDoubleClick={url ? reset : undefined}
        title={canUpload ? 'Replace, paste, or update plan image' : undefined}
      >
        {images.isLoading && <div className="absolute inset-0 animate-pulse bg-canvas-shell" />}
        {!images.isLoading && !url && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
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
                className="absolute bottom-2 right-2 rounded-md bg-white/80 px-2 py-1 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur-sm hover:bg-white"
                title="Reset view (or double-click)"
              >
                Reset
              </button>
            )}
            <div className="absolute top-2 right-2 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] text-neutral-400 pointer-events-none backdrop-blur-sm">
              {isZoomed ? `${Math.round(scale * 100)}%` : 'Scroll to zoom'}
            </div>
          </>
        )}
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="sr-only"
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
                className="pointer-events-auto rounded-md border border-white/60 bg-white/92 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-900 shadow-sm backdrop-blur-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                aria-label={`${url ? 'Replace image' : 'Add image'} for ${alt}`}
              >
                {url ? 'Replace image' : 'Add image'}
              </button>
              <span className="rounded-md bg-neutral-950/78 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm">
                {upload.isPending ? 'Uploading…' : 'Ctrl+V paste'}
              </span>
            </div>
          </>
        )}
      </div>
      {uploadError && <p className="text-xs text-danger-600">{uploadError}</p>}
    </div>
  );
}
