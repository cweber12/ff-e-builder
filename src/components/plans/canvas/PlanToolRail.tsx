import { useState, type ReactNode } from 'react';
import { PLAN_TOOL_DEFINITIONS } from './planToolDefinitions';
import type { PlanToolId, RectangleModeId } from './types';

type PlanToolRailProps = {
  activeTool: PlanToolId;
  isCalibrated: boolean;
  onToolChange: (tool: PlanToolId) => void;
  rectangleMode: RectangleModeId;
  onRectangleModeChange: (mode: RectangleModeId) => void;
};

export function PlanToolRail({
  activeTool,
  isCalibrated,
  onToolChange,
  rectangleMode,
  onRectangleModeChange,
}: PlanToolRailProps) {
  const [popoutOpen, setPopoutOpen] = useState(false);

  return (
    <aside className="overflow-y-auto border-r border-black/10 bg-canvas-chrome/80 p-2.5 backdrop-blur">
      <div className="flex flex-col gap-2">
        {PLAN_TOOL_DEFINITIONS.map((tool) => {
          const disabled = tool.id !== 'calibrate' && tool.id !== 'pan' && !isCalibrated;
          const active = activeTool === tool.id;
          const btnCls = [
            'flex h-11 w-11 items-center justify-center rounded-lg border transition',
            active
              ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
              : 'border-transparent bg-transparent text-neutral-500 hover:border-neutral-200 hover:bg-white hover:text-neutral-950',
            disabled && 'cursor-not-allowed border-transparent bg-transparent text-neutral-300',
          ].join(' ');

          if (tool.id === 'rectangle') {
            return (
              <div key={tool.id} className="relative">
                <button
                  type="button"
                  aria-label={tool.label}
                  title={`${tool.label}: ${tool.description}`}
                  disabled={disabled}
                  onClick={() =>
                    active
                      ? setPopoutOpen((v) => !v)
                      : (onToolChange(tool.id), setPopoutOpen(false))
                  }
                  className={`relative ${btnCls}`}
                >
                  <span className="sr-only">{tool.label}</span>
                  <ToolIcon toolId={tool.id} />
                  {active && (
                    <span className="pointer-events-none absolute bottom-0.5 left-0 right-0 text-center text-[8px] font-bold uppercase leading-none text-white/70">
                      {rectangleMode === 'measure' ? 'M' : 'H'}
                    </span>
                  )}
                </button>
                {popoutOpen && (
                  <div className="absolute left-full top-0 z-50 ml-2 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        onRectangleModeChange('measure');
                        setPopoutOpen(false);
                      }}
                      className={[
                        'block w-full whitespace-nowrap px-4 py-2.5 text-left text-sm transition hover:bg-neutral-50',
                        rectangleMode === 'measure'
                          ? 'font-semibold text-neutral-950'
                          : 'text-neutral-700',
                      ].join(' ')}
                    >
                      Measure
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRectangleModeChange('highlight');
                        setPopoutOpen(false);
                      }}
                      className={[
                        'block w-full whitespace-nowrap px-4 py-2.5 text-left text-sm transition hover:bg-neutral-50',
                        rectangleMode === 'highlight'
                          ? 'font-semibold text-neutral-950'
                          : 'text-neutral-700',
                      ].join(' ')}
                    >
                      Highlight
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              title={`${tool.label}: ${tool.description}`}
              disabled={disabled}
              onClick={() => {
                onToolChange(tool.id);
                setPopoutOpen(false);
              }}
              className={btnCls}
            >
              <span className="sr-only">{tool.label}</span>
              <ToolIcon toolId={tool.id} />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ToolIcon({ toolId }: { toolId: PlanToolId }) {
  if (toolId === 'calibrate') return <CalibrateIcon />;
  if (toolId === 'length') return <LengthLineIcon />;
  if (toolId === 'rectangle') return <RectangleIcon />;
  if (toolId === 'crop') return <CropIcon />;
  return <PanIcon />;
}

function ToolbarIcon({ children }: { children: ReactNode }) {
  return <span className="h-5 w-5">{children}</span>;
}

function CalibrateIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 15 15 3" />
        <circle cx="4" cy="16" r="2" fill="currentColor" stroke="none" />
        <circle cx="16" cy="4" r="2" fill="currentColor" stroke="none" />
      </svg>
    </ToolbarIcon>
  );
}

function LengthLineIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 10h14" />
        <path d="M5 7v6M9 8.5v3M13 8.5v3M17 7v6" />
      </svg>
    </ToolbarIcon>
  );
}

function RectangleIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="5" width="12" height="10" rx="1.5" />
      </svg>
    </ToolbarIcon>
  );
}

function CropIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M6 3v11a2 2 0 0 0 2 2h9" />
        <path d="M3 6h11a2 2 0 0 1 2 2v9" />
      </svg>
    </ToolbarIcon>
  );
}

function PanIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10 3v14M3 10h14" strokeLinecap="round" />
        <path
          d="m8 5 2-2 2 2M15 8l2 2-2 2M12 15l-2 2-2-2M5 12l-2-2 2-2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </ToolbarIcon>
  );
}
