import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { CreateMaterialInput, UpdateMaterialInput } from '../../lib/api';
import type { Material } from '../../types';
import { imageKeys, itemKeys, materialKeys, proposalKeys } from '../queryKeys';
import { appendListItem, removeListItem } from '../optimisticList';

export type MaterialContext =
  | { kind: 'ffe'; itemGroupId: string; projectId: string }
  | { kind: 'proposal'; itemGroupId: string; projectId: string };

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

/**
 * Returns { assign, createAndAssign, remove, update } mutations scoped to either
 * an FF&E Room (kind: 'ffe') or a Proposal Category (kind: 'proposal').
 * All mutations use itemId as the item identifier regardless of context.
 */
export function useItemMaterialActions(context: MaterialContext) {
  const queryClient = useQueryClient();
  const { kind, itemGroupId, projectId } = context;
  const invalidationKey =
    kind === 'ffe' ? itemKeys.forRoom(itemGroupId) : proposalKeys.items(itemGroupId);

  const assign = useMutation({
    mutationFn: ({ itemId, materialId }: { itemId: string; materialId: string }) =>
      kind === 'ffe'
        ? api.materials.assignToItem(itemId, materialId)
        : api.materials.assignToProposalItem(itemId, materialId),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidationKey }),
    onError: (err) => toast.error(`Material assignment failed: ${err.message}`),
  });

  const createAndAssign = useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: CreateMaterialInput }) =>
      kind === 'ffe'
        ? api.materials.createAndAssignToItem(itemId, input)
        : api.materials.createAndAssignToProposalItem(itemId, input),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidationKey }),
    onError: (err) => toast.error(`Material assignment failed: ${err.message}`),
  });

  const remove = useMutation({
    mutationFn: ({ itemId, materialId }: { itemId: string; materialId: string }) =>
      kind === 'ffe'
        ? api.materials.removeFromItem(itemId, materialId)
        : api.materials.removeFromProposalItem(itemId, materialId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidationKey }),
    onError: (err) => toast.error(`Material removal failed: ${err.message}`),
  });

  const update = useMutation({
    mutationFn: ({
      itemId,
      materialId,
      patch,
    }: {
      itemId: string;
      materialId: string;
      patch: UpdateMaterialInput;
    }) =>
      kind === 'ffe'
        ? api.materials.updateForItem(itemId, materialId, patch)
        : api.materials.updateForProposalItem(itemId, materialId, patch),
    onSuccess: (material) => {
      queryClient.setQueryData<Material[]>(materialKeys.forProject(projectId), (old) =>
        upsertMaterial(old, material),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidationKey }),
    onError: (err) => toast.error(`Material update failed: ${err.message}`),
  });

  return { assign, createAndAssign, remove, update };
}

function upsertMaterial(old: Material[] | undefined, material: Material): Material[] {
  const next = appendListItem(removeListItem(old, material.id), material);
  return next.sort((a, b) => a.name.localeCompare(b.name));
}
