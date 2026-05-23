export type MaterialCategory = 'wood' | 'metal' | 'stone' | 'glass' | 'fabric' | 'solid_color';

export type Material = {
  id: string;
  projectId: string;
  name: string;
  materialId: string;
  description: string;
  swatchHex: string;
  manufacturer: string;
  sourceUrl: string;
  category: MaterialCategory | null;
  subCategory: string;
  createdAt: string;
  updatedAt: string;
};
