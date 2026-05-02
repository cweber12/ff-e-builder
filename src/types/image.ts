export type ImageEntityType = 'project' | 'room' | 'item';

export type ImageAsset = {
  id: string;
  ownerUid: string;
  projectId: string;
  roomId: string | null;
  itemId: string | null;
  filename: string;
  contentType: string;
  byteSize: number;
  altText: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};
