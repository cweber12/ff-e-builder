import type { ReactNode } from 'react';
import { PLAN_TOOL_DEFINITIONS, PLAN_TOOL_GROUPS } from './planToolDefinitions';
import type { PlanToolId } from './types';

type PlanToolRailProps = {
  activeTool: PlanToolId;
  isCalibrated: boolean;
  onToolChange: (tool: PlanToolId) => void;
};

export function PlanToolRail({ activeTool, isCalibrated, onToolChange }: PlanToolRailProps) {
  return (
    <aside
      className="overflow-y-auto border-r border-neutral-200 bg-canvas-chrome/80 py-3 backdrop-blur"
      aria-label="Plan tools"
    >
      {PLAN_TOOL_GROUPS.map((group, groupIndex) => {
        const tools = PLAN_TOOL_DEFINITIONS.filter((tool) => tool.group === group.id);
        if (tools.length === 0) return null;

        return (
          <div key={group.id}>
            <div
              className={[
                'mx-3 flex items-center justify-center px-1 pb-1 pt-2',
                groupIndex > 0 ? 'mt-2 border-t border-neutral-200/70' : '',
              ].join(' ')}
            >
              <span className="rail-label">{group.label}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 px-3">
              {tools.map((tool) => {
                const disabled = tool.id !== 'calibrate' && tool.id !== 'pan' && !isCalibrated;
                const active = activeTool === tool.id;

                return (
                  <div key={tool.id} className="flex w-11 flex-col items-center gap-1">
                    <button
                      type="button"
                      aria-label={tool.label}
                      title={`${tool.label}: ${tool.description}`}
                      disabled={disabled}
                      onClick={() => onToolChange(tool.id)}
                      className={[
                        'relative flex h-11 w-11 items-center justify-center rounded-lg border transition',
                        active
                          ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
                          : 'border-transparent bg-transparent text-neutral-500 hover:border-neutral-200 hover:bg-white hover:text-neutral-950',
                        disabled
                          ? 'cursor-not-allowed border-transparent bg-transparent text-neutral-300 hover:border-transparent hover:bg-transparent hover:text-neutral-300'
                          : '',
                      ].join(' ')}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute -left-2.5 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-brand-500"
                        />
                      ) : null}
                      <span className="sr-only">{tool.label}</span>
                      <ToolIcon toolId={tool.id} />
                      {disabled ? (
                        <span
                          aria-hidden
                          className="absolute bottom-0.5 right-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/90 text-neutral-400 shadow-sm"
                        >
                          <LockIcon />
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function ToolIcon({ toolId }: { toolId: PlanToolId }) {
  if (toolId === 'calibrate') return <CalibrateIcon />;
  if (toolId === 'select') return <SelectIcon />;
  if (toolId === 'length') return <LengthLineIcon />;
  if (toolId === 'rectangle') return <RectangleIcon />;
  if (toolId === 'crop') return <CropIcon />;
  return <PanIcon />;
}

function ToolbarIcon({ children }: { children: ReactNode }) {
  return <span className="h-5 w-5">{children}</span>;
}

function SelectIcon() {
  return (
    <ToolbarIcon>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M5 3.5 14.5 10 10.2 11.2 8 16.5 5 3.5Z" strokeLinejoin="round" />
        <path d="M10.3 11.2 14.2 15.1" strokeLinecap="round" />
      </svg>
    </ToolbarIcon>
  );
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

function LockIcon() {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      className="h-2.5 w-2.5"
    >
      <rect x="2" y="4.5" width="6" height="4" rx="0.8" />
      <path d="M3.5 4.5V3a1.5 1.5 0 0 1 3 0v1.5" />
    </svg>
  );
}
