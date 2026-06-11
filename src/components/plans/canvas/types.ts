import type { Measurement } from '../../../types';

export type PlanToolId = 'calibrate' | 'select' | 'length' | 'rectangle' | 'crop' | 'pan';

export type RectangleModeId = 'measure' | 'highlight';

export type MeasurementApplicationMode =
  | 'proposal-horizontal'
  | 'proposal-vertical'
  | 'proposal-area'
  | 'proposal-footprint'
  | 'ffe-dimensions';

export type MeasurementItemRef = {
  key: string;
  targetKind: Measurement['targetKind'];
  targetItemId: string;
  targetTagSnapshot: string;
  primaryLabel: string;
  secondaryLabel: string;
  containerLabel: string;
  containerId: string;
  version: number;
  dimensions?: string | null;
  drawings?: string | null;
  quantity?: number;
  quantityUnit?: string;
  linkedFfeItemId?: string | null;
  linkedProposalItemId?: string | null;
};

export type MeasurementDisplay = {
  horizontal: number;
  vertical: number;
  area: number;
  dimensionsText: string;
};
