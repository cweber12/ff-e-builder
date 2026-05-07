import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/primitives';
import { useMeasuredPlans } from '../hooks';
import { api } from '../lib/api';
import type { MeasuredPlan, Project } from '../types';

type PlanCanvasPageProps = {
  project: Project;
  planId: string;
};

const TOOL_DEFINITIONS = [
  { id: 'calibrate', label: 'Calibrate', description: 'Set the plan scale from a reference line.' },
  { id: 'length', label: 'Length Line', description: 'Measure a linear span on the plan.' },
  {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'Capture an item footprint before attach + crop.',
  },
  { id: 'crop', label: 'Crop', description: 'Refine the derived plan image framing.' },
] as const;

type ToolId = (typeof TOOL_DEFINITIONS)[number]['id'];

export function PlanCanvasPage({ project, planId }: PlanCanvasPageProps) {
  const { data: plans, isLoading } = useMeasuredPlans(project.id);
  const [activeTool, setActiveTool] = useState<ToolId>('calibrate');

  const selectedPlan = useMemo(
    () => plans?.find((candidate) => candidate.id === planId) ?? null,
    [planId, plans],
  );

  useEffect(() => {
    if (!selectedPlan) return;
    if (selectedPlan.calibrationStatus === 'calibrated' && activeTool === 'calibrate') return;
    if (selectedPlan.calibrationStatus === 'uncalibrated') {
      setActiveTool('calibrate');
    }
  }, [activeTool, selectedPlan]);

  if (isLoading) {
    return <PlanCanvasSkeleton />;
  }

  if (!selectedPlan) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">This Measured Plan could not be found.</p>
        <Link
          to={`/projects/${project.id}/plans`}
          className="mt-4 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          Back to Plans library
        </Link>
      </div>
    );
  }

  const isCalibrated = selectedPlan.calibrationStatus === 'calibrated';

  return (
    <div className="-mx-4 flex min-h-[calc(100vh-185px)] flex-col bg-[#f3f1ea] md:-mx-6">
      <header className="border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Link
              to={`/projects/${project.id}/plans`}
              className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 hover:text-brand-600"
            >
              Plans Library
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold text-neutral-900">
                {selectedPlan.name}
              </h1>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                {selectedPlan.sheetReference || 'No sheet ref'}
              </span>
              <span
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                  isCalibrated ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
                ].join(' ')}
              >
                {selectedPlan.calibrationStatus}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              Workspace shell for calibration and measurements. This slice focuses on the opened
              plan surface, image viewport controls, and tool framing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled>
              Upload replacement
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled>
              Save workspace
            </Button>
          </div>
        </div>
      </header>

      <div className="grid flex-1 gap-0 xl:grid-cols-[96px_minmax(0,1fr)_320px]">
        <aside className="border-r border-black/5 bg-white/72 p-3 backdrop-blur">
          <div className="flex flex-col gap-2">
            {TOOL_DEFINITIONS.map((tool) => {
              const disabled = tool.id !== 'calibrate' && !isCalibrated;
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveTool(tool.id)}
                  className={[
                    'rounded-2xl border px-3 py-3 text-left transition',
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-brand-200 hover:text-brand-700',
                    disabled &&
                      'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400',
                  ].join(' ')}
                  title={tool.description}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em]">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 p-4 md:p-6">
          <PlanViewport projectId={project.id} plan={selectedPlan} />
        </main>

        <aside className="border-l border-black/5 bg-white/72 p-4 backdrop-blur md:p-5">
          <div className="space-y-5">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Plan Selector
              </p>
              <div className="mt-3 space-y-2">
                {(plans ?? []).map((plan) => {
                  const active = plan.id === selectedPlan.id;
                  return (
                    <Link
                      key={plan.id}
                      to={`/projects/${project.id}/plans/${plan.id}`}
                      className={[
                        'block rounded-2xl border px-3 py-3 transition',
                        active
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-neutral-200 bg-white hover:border-brand-200 hover:bg-brand-50/40',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">
                            {plan.name}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {plan.sheetReference || 'No sheet reference'}
                          </p>
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                          {plan.measurementCount}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Calibration
              </p>
              <p className="mt-3 text-sm font-medium text-neutral-800">
                {isCalibrated ? 'Calibrated' : 'Needs calibration'}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {isCalibrated
                  ? 'Length, rectangle, and crop tools can build on the saved plan scale.'
                  : 'Length, rectangle, and crop tools stay disabled until this plan has a calibration reference.'}
              </p>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Measurements
                </p>
                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-500">
                  {selectedPlan.measurementCount}
                </span>
              </div>
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-sm leading-6 text-neutral-500">
                Saved measurement rows and canvas selection land in the next slice once rectangle
                CRUD is wired.
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Active Tool
              </p>
              <p className="mt-3 text-sm font-semibold text-neutral-900">
                {TOOL_DEFINITIONS.find((tool) => tool.id === activeTool)?.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {TOOL_DEFINITIONS.find((tool) => tool.id === activeTool)?.description}
              </p>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PlanViewport({ projectId, plan }: { projectId: string; plan: MeasuredPlan }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  zoomRef.current = zoom;
  offsetRef.current = offset;

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    async function loadImage() {
      setLoading(true);
      setImageUrl(null);
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

  const rotateClockwise = useCallback(() => {
    setRotation((current) => (current + 90) % 360);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const onWheel = (event: WheelEvent) => {
      if (!imageUrl) return;
      event.preventDefault();

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
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [clampOffset, imageUrl]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageUrl || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const deltaX = event.clientX - dragStart.current.px;
    const deltaY = event.clientY - dragStart.current.py;
    setOffset(clampOffset(zoom, dragStart.current.ox + deltaX, dragStart.current.oy + deltaY));
  };

  const handlePointerUp = () => {
    dragStart.current = null;
  };

  const showReset = zoom > 1.01 || rotation !== 0 || offset.x !== 0 || offset.y !== 0;

  return (
    <div className="grid h-full gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/72 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setZoom((current) => Math.min(5, current * 1.15))}
          >
            Zoom in
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setZoom((current) => {
                const nextZoom = Math.max(1, current / 1.15);
                setOffset((currentOffset) =>
                  clampOffset(nextZoom, currentOffset.x, currentOffset.y),
                );
                return nextZoom;
              });
            }}
          >
            Zoom out
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={rotateClockwise}>
            Rotate 90°
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetView} disabled={!showReset}>
            Reset view
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
          <span>{Math.round(zoom * 100)}%</span>
          <span>{rotation}°</span>
          <span>{plan.imageFilename}</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[58vh] overflow-hidden rounded-[28px] border border-black/5 bg-[#e7dfd1] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        style={{ cursor: imageUrl ? (dragStart.current ? 'grabbing' : 'grab') : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={resetView}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_54%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
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
                height: naturalSize.height || undefined,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${effectiveScale})`,
                transformOrigin: 'center center',
                transition: dragStart.current ? 'none' : 'transform 0.08s ease-out',
              }}
            />
            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 backdrop-blur">
              Scroll to zoom • drag to pan • double-click to reset
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function PlanCanvasSkeleton() {
  return (
    <div className="-mx-4 grid min-h-[calc(100vh-185px)] gap-0 bg-[#f3f1ea] md:-mx-6 xl:grid-cols-[96px_minmax(0,1fr)_320px]">
      <div className="border-r border-black/5 bg-white/72 p-3">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
      <div className="p-6">
        <div className="h-full min-h-[70vh] animate-pulse rounded-[28px] bg-white/70" />
      </div>
      <div className="border-l border-black/5 bg-white/72 p-4">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
