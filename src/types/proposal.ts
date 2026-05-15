import type { Material } from './material';
import type { ProposalStatus } from './proposalValidation';

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
  /** User-defined custom column values keyed by CustomColumnDef id */
  customData: Record<string, string>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ProposalItemChangelogEntry = {
  id: string;
  proposalItemId: string;
  columnKey: string;
  previousValue: string;
  newValue: string;
  notes: string | null;
  proposalStatus: ProposalStatus;
  relatedChangeId: string | null;
  revisionId: string | null;
  isPriceAffecting: boolean;
  changedAt: string;
};

export type RevisionCostStatus = 'none' | 'flagged' | 'resolved';

export type RevisionSnapshot = {
  revisionId: string;
  itemId: string;
  quantity: number | null;
  unitCostCents: number | null;
  costStatus: RevisionCostStatus;
};

export type ProposalRevision = {
  id: string;
  projectId: string;
  revisionMajor: number;
  revisionMinor: number;
  /** e.g. "1.2" */
  label: string;
  triggeredAtStatus: 'pricing_complete' | 'submitted' | 'approved';
  openedAt: string;
  closedAt: string | null;
};

export type ProposalCategoryWithItems = ProposalCategory & {
  items: ProposalItem[];
};
