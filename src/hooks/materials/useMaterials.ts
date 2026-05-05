import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { CreateMaterialInput, UpdateMaterialInput } from '../../lib/api';
import type { Material } from '../../types';
import { imageKeys, itemKeys, materialKeys, proposalKeys } from '../queryKeys';
import { appendListItem, removeListItem } from '../optimisticList';

export { materialKeys } from '../queryKeys';

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
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
    onError: (err) => toast.error(`Material update failed: ${err.message}`),
  });
}

export function useDeleteMaterial(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.materials.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        removeListItem(old, id),
      );
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
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

export function useAssignMaterialToProposalItem(categoryId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalItemId, materialId }: { proposalItemId: string; materialId: string }) =>
      api.materials.assignToProposalItem(proposalItemId, materialId),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: proposalKeys.items(categoryId) }),
    onError: (err) => toast.error(`Material assignment failed: ${err.message}`),
  });
}

export function useCreateAndAssignMaterialToProposalItem(categoryId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      proposalItemId,
      input,
    }: {
      proposalItemId: string;
      input: CreateMaterialInput;
    }) => api.materials.createAndAssignToProposalItem(proposalItemId, input),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: proposalKeys.items(categoryId) }),
    onError: (err) => toast.error(`Material assignment failed: ${err.message}`),
  });
}

export function useRemoveMaterialFromProposalItem(categoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalItemId, materialId }: { proposalItemId: string; materialId: string }) =>
      api.materials.removeFromProposalItem(proposalItemId, materialId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: proposalKeys.items(categoryId) }),
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

export function useUpdateMaterialForProposalItem(categoryId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      proposalItemId,
      materialId,
      patch,
    }: {
      proposalItemId: string;
      materialId: string;
      patch: UpdateMaterialInput;
    }) => api.materials.updateForProposalItem(proposalItemId, materialId, patch),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: proposalKeys.items(categoryId) }),
    onError: (err) => toast.error(`Material update failed: ${err.message}`),
  });
}

function upsertMaterial(old: Material[] | undefined, material: Material): Material[] {
  const next = appendListItem(removeListItem(old, material.id), material);
  return next.sort((a, b) => a.name.localeCompare(b.name));
}
