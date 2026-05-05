import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { imageKeys } from '../queryKeys';
import { removeListItem, replaceListItem } from '../optimisticList';
import type { CropParams, ImageAsset, ImageEntityType } from '../../types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedImageEntityId(entityId: string) {
  return uuidPattern.test(entityId);
}

function insertUploadedPrimaryImage(
  old: ImageAsset[] | undefined,
  image: ImageAsset,
): ImageAsset[] {
  return [
    image,
    ...(old ?? [])
      .filter((candidate) => candidate.id !== image.id)
      .map((candidate) => ({ ...candidate, isPrimary: false })),
  ];
}

function markPrimaryImage(old: ImageAsset[] | undefined, primaryImage: ImageAsset): ImageAsset[] {
  return (
    old?.map((image) => ({
      ...image,
      isPrimary: image.id === primaryImage.id,
    })) ?? [primaryImage]
  );
}

export function useImages(entityType: ImageEntityType, entityId: string) {
  return useQuery({
    queryKey: imageKeys.forEntity(entityType, entityId),
    queryFn: () => api.images.list({ entityType, entityId }),
    enabled: isPersistedImageEntityId(entityId),
  });
}

export function useUploadImage(entityType: ImageEntityType, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, altText }: { file: File; altText?: string }) =>
      api.images.upload({
        entityType,
        entityId,
        file,
        ...(altText !== undefined ? { altText } : {}),
      }),
    onSuccess: (image) => {
      queryClient.setQueryData<ImageAsset[]>(imageKeys.forEntity(entityType, entityId), (old) =>
        insertUploadedPrimaryImage(old, image),
      );
    },
    onError: (err) => toast.error(`Image upload failed: ${err.message}`),
  });
}

export function useDeleteImage(entityType: ImageEntityType, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) => api.images.delete(imageId),
    onSuccess: async (_data, imageId) => {
      queryClient.setQueryData<ImageAsset[]>(imageKeys.forEntity(entityType, entityId), (old) =>
        removeListItem(old, imageId),
      );
      await queryClient.invalidateQueries({ queryKey: imageKeys.forEntity(entityType, entityId) });
    },
    onError: (err) => toast.error(`Image delete failed: ${err.message}`),
  });
}

export function useSetPrimaryImage(entityType: ImageEntityType, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) => api.images.setPrimary(imageId),
    onSuccess: (primaryImage) => {
      queryClient.setQueryData<ImageAsset[]>(imageKeys.forEntity(entityType, entityId), (old) =>
        markPrimaryImage(old, primaryImage),
      );
    },
    onError: (err) => toast.error(`Preview image update failed: ${err.message}`),
  });
}

export function useUpdateImageCrop(entityType: ImageEntityType, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ imageId, params }: { imageId: string; params: CropParams | null }) =>
      api.images.setCrop(imageId, params),
    onSuccess: (updated) => {
      queryClient.setQueryData<ImageAsset[]>(imageKeys.forEntity(entityType, entityId), (old) =>
        replaceListItem(old, updated.id, updated),
      );
    },
    onError: (err) => toast.error(`Crop update failed: ${err.message}`),
  });
}
