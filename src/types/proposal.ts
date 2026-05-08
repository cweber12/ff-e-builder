import type { Material } from './material';

export type SizeMode = 'imperial' | 'metric';
export type MeasurementUnit = 'ft/in' | 'mm' | 'cm' | 'm';
export type ProposalQuantityUnit = string;

export type UserProfile = {
  ownerUid: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  createdAt: string;
  updatedAt: string;
  authorized: boolean;
};

export type ProposalCategory = {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProposalItem = {
  id: string;
  categoryId: string;
  productTag: string;
  plan: string;
  drawings: string;
  location: string;
  description: string;
  notes: string;
  sizeLabel: string;
  sizeMode: SizeMode;
  sizeW: string;
  sizeD: string;
  sizeH: string;
  sizeUnit: MeasurementUnit;
  materials: Material[];
  cbm: number;
  quantity: number;
  quantityUnit: ProposalQuantityUnit;
  unitCostCents: number;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ProposalCategoryWithItems = ProposalCategory & {
  items: ProposalItem[];
};
