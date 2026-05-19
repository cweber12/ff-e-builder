import type { PlanToolId } from './types';

export type PlanToolGroupId = 'setup' | 'measure' | 'crop' | 'view';

export type PlanToolDefinition = {
  id: PlanToolId;
  label: string;
  description: string;
  group: PlanToolGroupId;
};

export const PLAN_TOOL_DEFINITIONS: PlanToolDefinition[] = [
  {
    id: 'calibrate',
    label: 'Calibrate',
    description: 'Set the plan scale from a reference line.',
    group: 'setup',
  },
  {
    id: 'length',
    label: 'Length Line',
    description: 'Measure and save linear spans on the plan.',
    group: 'measure',
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'Capture an item footprint and associate it with an item.',
    group: 'measure',
  },
  {
    id: 'crop',
    label: 'Crop',
    description: 'Refine the derived plan image framing.',
    group: 'crop',
  },
  {
    id: 'pan',
    label: 'Pan',
    description: 'Drag to move around the plan at any zoom level.',
    group: 'view',
  },
];

export const PLAN_TOOL_GROUPS: Array<{ id: PlanToolGroupId; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'measure', label: 'Measure' },
  { id: 'crop', label: 'Crop' },
  { id: 'view', label: 'View' },
];

export function getPlanToolLabel(toolId: PlanToolId) {
  return PLAN_TOOL_DEFINITIONS.find((tool) => tool.id === toolId)?.label ?? 'Measure';
}
