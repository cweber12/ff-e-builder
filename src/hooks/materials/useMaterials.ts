import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { CreateMaterialInput, UpdateMaterialInput } from '../../lib/api';
import type { Material } from '../../types';
import { itemKeys } from '../ffe/useItems';
import { imageKeys } from '../shared/useImages';
import { takeoffKeys } from '../takeoff/useTakeoff';

export const materialKeys = {
  forProject: (projectId: string) => ['materials', projectId] as const,
};

export function useMaterials(projectId: string) {
  return useQuery({
    queryKey: materialKeys.forProject(projectId),
    queryFn: () => api.materials.list(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateMaterial(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaterialInput) => api.materials.create(projectId, input),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onError: (err) => toast.error(`Material create failed: ${err.message}`),
  });
}

export function useUpdateMaterial(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMaterialInput }) =>
      api.materials.update(id, patch),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (err) => toast.error(`Material update failed: ${err.message}`),
  });
}

export function useDeleteMaterial(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.materials.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Material[]>(
        materialKeys.forProject(projectId),
        (old) => old?.filter((material) => material.id !== id) ?? [],
      );
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.removeQueries({ queryKey: imageKeys.forEntity('material', id) });
    },
    onError: (err) => toast.error(`Material delete failed: ${err.message}`),
  });
}

export function useAssignMaterial(roomId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, materialId }: { itemId: string; materialId: string }) =>
      api.materials.assignToItem(itemId, materialId),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) }),
    onError: (err) => toast.error(`Material assignment failed: ${err.message}`),
  });
}

export function useCreateAndAssignMaterial(roomId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: CreateMaterialInput }) =>
      api.materials.createAndAssignToItem(itemId, input),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) }),
    onError: (err) => toast.error(`Material assignment failed: ${err.message}`),
  });
}

export function useRemoveMaterialFromItem(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, materialId }: { itemId: string; materialId: string }) =>
      api.materials.removeFromItem(itemId, materialId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) }),
    onError: (err) => toast.error(`Material removal failed: ${err.message}`),
  });
}

export function useAssignMaterialToTakeoffItem(categoryId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ takeoffItemId, materialId }: { takeoffItemId: string; materialId: string }) =>
      api.materials.assignToTakeoffItem(takeoffItemId, materialId),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: takeoffKeys.items(categoryId) }),
    onError: (err) => toast.error(`Material assignment failed: ${err.message}`),
  });
}

export function useCreateAndAssignMaterialToTakeoffItem(categoryId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ takeoffItemId, input }: { takeoffItemId: string; input: CreateMaterialInput }) =>
      api.materials.createAndAssignToTakeoffItem(takeoffItemId, input),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: takeoffKeys.items(categoryId) }),
    onError: (err) => toast.error(`Material assignment failed: ${err.message}`),
  });
}

export function useRemoveMaterialFromTakeoffItem(categoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ takeoffItemId, materialId }: { takeoffItemId: string; materialId: string }) =>
      api.materials.removeFromTakeoffItem(takeoffItemId, materialId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: takeoffKeys.items(categoryId) }),
    onError: (err) => toast.error(`Material removal failed: ${err.message}`),
  });
}

export function useUpdateMaterialForItem(roomId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      materialId,
      patch,
    }: {
      itemId: string;
      materialId: string;
      patch: UpdateMaterialInput;
    }) => api.materials.updateForItem(itemId, materialId, patch),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) }),
    onError: (err) => toast.error(`Material update failed: ${err.message}`),
  });
}

export function useUpdateMaterialForTakeoffItem(categoryId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      takeoffItemId,
      materialId,
      patch,
    }: {
      takeoffItemId: string;
      materialId: string;
      patch: UpdateMaterialInput;
    }) => api.materials.updateForTakeoffItem(takeoffItemId, materialId, patch),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: takeoffKeys.items(categoryId) }),
    onError: (err) => toast.error(`Material update failed: ${err.message}`),
  });
}

function upsertMaterial(old: Material[] | undefined, material: Material): Material[] {
  const next = [material, ...(old ?? []).filter((candidate) => candidate.id !== material.id)];
  return next.sort((a, b) => a.name.localeCompare(b.name));
}
