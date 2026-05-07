export type ImageEntityType =
  | 'project'
  | 'room'
  | 'item'
  | 'item_plan'
  | 'item_option'
  | 'material'
  | 'proposal_item'
  | 'proposal_swatch'
  | 'proposal_plan';

export type ImageAsset = {
  id: string;
  entityType: ImageEntityType;
  ownerUid: string;
  projectId: string;
  roomId: string | null;
  itemId: string | null;
  materialId: string | null;
  proposalItemId: string | null;
  filename: string;
  contentType: string;
  byteSize: number;
  altText: string;
  isPrimary: boolean;
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CropParams = {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

/** Entity types that support user-controlled crop. */
export const CROPPABLE_ENTITY_TYPES = new Set<ImageEntityType>([
  'item',
  'item_plan',
  'item_option',
  'proposal_item',
  'proposal_plan',
  'project',
]);

/** Export cell aspect ratios per croppable entity type (width / height). */
export const CROP_ASPECT: Partial<Record<ImageEntityType, number>> = {
  item: 117 / 75,
  item_plan: 103 / 75,
  item_option: 117 / 75,
  proposal_item: 117 / 75,
  proposal_plan: 103 / 75,
  project: 4 / 3,
};
