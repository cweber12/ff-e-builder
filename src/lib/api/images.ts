import { compressImage } from '../images';
import { apiFetch, apiFetchResponse } from './transport';
import { mapImageAsset, type RawImageAsset } from './mappers';
import type { CropParams, ImageAsset, ImageEntityType } from '../../types';

export type ImageEntityRef = {
  entityType: ImageEntityType;
  entityId: string;
};

export type UploadImageInput = ImageEntityRef & {
  file: File;
  altText?: string;
};

const cropPayload = (params: CropParams | null) =>
  params
    ? {
        crop_x: params.cropX,
        crop_y: params.cropY,
        crop_width: params.cropWidth,
        crop_height: params.cropHeight,
      }
    : { crop_x: null, crop_y: null, crop_width: null, crop_height: null };

export const imagesApi = {
  list: ({ entityType, entityId }: ImageEntityRef): Promise<ImageAsset[]> => {
    const params = new URLSearchParams({
      entity_type: entityType,
      entity_id: entityId,
    });
    return apiFetch<{ images: RawImageAsset[] }>(`/api/v1/images?${params}`).then((r) =>
      r.images.map(mapImageAsset),
    );
  },

  upload: async ({
    entityType,
    entityId,
    file,
    altText = '',
  }: UploadImageInput): Promise<ImageAsset> => {
    const compressed = await compressImage(file);
    const params = new URLSearchParams({
      entity_type: entityType,
      entity_id: entityId,
      alt_text: altText,
    });
    const body = new FormData();
    body.append('file', compressed);

    return apiFetch<{ image: RawImageAsset }>(`/api/v1/images?${params}`, {
      method: 'POST',
      body,
    }).then((r) => mapImageAsset(r.image));
  },

  getContentBlob: async (imageId: string): Promise<Blob> => {
    const response = await apiFetchResponse(`/api/v1/images/${imageId}/content`);
    return response.blob();
  },

  delete: (imageId: string): Promise<void> =>
    apiFetch<void>(`/api/v1/images/${imageId}`, { method: 'DELETE' }),

  setPrimary: (imageId: string): Promise<ImageAsset> =>
    apiFetch<{ image: RawImageAsset }>(`/api/v1/images/${imageId}/primary`, {
      method: 'PATCH',
    }).then((r) => mapImageAsset(r.image)),

  setCrop: (imageId: string, params: CropParams | null): Promise<ImageAsset> =>
    apiFetch<{ image: RawImageAsset }>(`/api/v1/images/${imageId}/crop`, {
      method: 'PATCH',
      body: JSON.stringify(cropPayload(params)),
    }).then((r) => mapImageAsset(r.image)),
};
