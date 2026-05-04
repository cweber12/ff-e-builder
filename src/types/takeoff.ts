import type { Material } from './material';

export type SizeMode = 'imperial' | 'metric';
export type MeasurementUnit = 'ft/in' | 'mm' | 'cm' | 'm';
export type TakeoffQuantityUnit = string;

export type UserProfile = {
  ownerUid: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  createdAt: string;
  updatedAt: string;
};

export type TakeoffCategory = {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TakeoffItem = {
  id: string;
  categoryId: string;
  productTag: string;
  plan: string;
  drawings: string;
  location: string;
  description: string;
  sizeLabel: string;
  sizeMode: SizeMode;
  sizeW: string;
  sizeD: string;
  sizeH: string;
  sizeUnit: MeasurementUnit;
  swatches: string[];
  materials: Material[];
  cbm: number;
  quantity: number;
  quantityUnit: TakeoffQuantityUnit;
  unitCostCents: number;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TakeoffCategoryWithItems = TakeoffCategory & {
  items: TakeoffItem[];
};
