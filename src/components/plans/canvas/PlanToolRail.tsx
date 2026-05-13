import type { ReactNode } from 'react';
import { PLAN_TOOL_DEFINITIONS } from './planToolDefinitions';
import type { PlanToolId } from './types';

type PlanToolRailProps = {
  activeTool: PlanToolId;
  isCalibrated: boolean;
  onToolChange: (tool: PlanToolId) => void;
};

export function PlanToolRail({ activeTool, isCalibrated, onToolChange }: PlanToolRailProps) {
  return (
    <aside className="overflow-y-auto border-r border-black/10 bg-[#fbfaf6]/80 p-2.5 backdrop-blur">
      <div className="flex flex-col gap-2">
        {PLAN_TOOL_DEFINITIONS.map((tool) => {
          const disabled = tool.id !== 'calibrate' && tool.id !== 'pan' && !isCalibrated;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              title={`${tool.label}: ${tool.description}`}
              disabled={disabled}
              onClick={() => onToolChange(tool.id)}
              className={[
                'flex h-11 w-11 items-center justify-center rounded-lg border transition',
                active
                  ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
                  : 'border-transparent bg-transparent text-neutral-500 hover:border-neutral-200 hover:bg-white hover:text-neutral-950',
                disabled && 'cursor-not-allowed border-transparent bg-transparent text-neutral-300',
              ].join(' ')}
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
