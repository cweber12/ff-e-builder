export type FinishClassification = 'material' | 'swatch' | 'hybrid';

export type Material = {
  id: string;
  projectId: string;
  name: string;
  materialId: string;
  description: string;
  swatchHex: string;
  swatches: string[];
  finishClassification: FinishClassification;
  createdAt: string;
  updatedAt: string;
};
