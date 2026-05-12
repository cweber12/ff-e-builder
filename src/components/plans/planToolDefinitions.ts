import type { PlanToolId } from './types';

export const PLAN_TOOL_DEFINITIONS: Array<{
  id: PlanToolId;
  label: string;
  description: string;
}> = [
  {
    id: 'calibrate',
    label: 'Calibrate',
    description: 'Set the plan scale from a reference line.',
  },
  {
    id: 'length',
    label: 'Length Line',
    description: 'Measure and save linear spans on the plan.',
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'Capture an item footprint and associate it with an item.',
  },
  {
    id: 'crop',
    label: 'Crop',
    description: 'Refine the derived plan image framing.',
  },
  {
    id: 'pan',
    label: 'Pan',
    description: 'Drag to move around the plan at any zoom level.',
  },
];

export function getPlanToolLabel(toolId: PlanToolId) {
  return PLAN_TOOL_DEFINITIONS.find((tool) => tool.id === toolId)?.label ?? 'Measure';
}
