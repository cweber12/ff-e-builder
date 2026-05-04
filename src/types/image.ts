export type ImageEntityType =
  | 'project'
  | 'room'
  | 'item'
  | 'material'
  | 'takeoff_item'
  | 'takeoff_swatch';

export type ImageAsset = {
  id: string;
  ownerUid: string;
  projectId: string;
  roomId: string | null;
  itemId: string | null;
  materialId: string | null;
  takeoffItemId: string | null;
  filename: string;
  contentType: string;
  byteSize: number;
  altText: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};
