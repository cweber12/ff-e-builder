export type MaterialCategory = 'wood' | 'metal' | 'stone' | 'glass' | 'fabric' | 'solid_color';

export type MaterialType =
  | 'veneer'
  | 'laminate'
  | 'solid'
  | 'powder_coat'
  | 'anodized'
  | 'upholstery'
  | 'stone_slab'
  | 'glass'
  | 'painted'
  | 'stained';

export type Finish = {
  id: string;
  projectId: string;
  code: string;
  name: string;
  category: MaterialCategory | null;
  subCategory: string;
  description: string;
  manufacturer: string;
  sourceUrl: string;
  swatchHex: string;
  createdAt: string;
  updatedAt: string;
};

export type Material = {
  id: string;
  projectId: string;
  code: string;
  finishId: string | null;
  finish?: Finish;
  materialType: MaterialType | null;
  name: string;
  materialId: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};
