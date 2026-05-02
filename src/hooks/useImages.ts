import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { ImageAsset, ImageEntityType } from '../types';

export const imageKeys = {
  all: ['images'] as const,
  forEntity: (entityType: ImageEntityType, entityId: string) =>
    ['images', entityType, entityId] as const,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedImageEntityId(entityId: string) {
  return uuidPattern.test(entityId);
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
      queryClient.setQueryData<ImageAsset[]>(imageKeys.forEntity(entityType, entityId), (old) => [
        image,
        ...(old ?? []).filter((candidate) => candidate.id !== image.id),
      ]);
    },
    onError: (err) => toast.error(`Image upload failed: ${err.message}`),
  });
}

export function useDeleteImage(entityType: ImageEntityType, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) => api.images.delete(imageId),
    onSuccess: (_data, imageId) => {
      queryClient.setQueryData<ImageAsset[]>(
        imageKeys.forEntity(entityType, entityId),
        (old) => old?.filter((image) => image.id !== imageId) ?? [],
      );
    },
    onError: (err) => toast.error(`Image delete failed: ${err.message}`),
  });
}
