import type { Measurement } from '../../types';

export type PlanToolId = 'calibrate' | 'length' | 'rectangle' | 'crop' | 'pan';

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
  quantity?: number;
  quantityUnit?: string;
};
