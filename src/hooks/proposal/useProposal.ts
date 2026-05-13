import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { proposalKeys } from '../queryKeys';
import {
  appendListItem,
  appendUniqueListItem,
  removeListItem,
  restoreQueryList,
  snapshotQueryList,
  updateListItem,
} from '../optimisticList';
import type {
  CreateProposalCategoryInput,
  CreateProposalItemInput,
  UpdateProposalCategoryInput,
  UpdateProposalItemInput,
} from '../../lib/api';
import type {
  ProposalCategory,
  ProposalCategoryWithItems,
  ProposalItem,
  ProposalItemChangelogEntry,
} from '../../types';

export function useProposalCategories(projectId: string) {
  return useQuery({
    queryKey: proposalKeys.categories(projectId),
    queryFn: () => api.proposal.categories(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProposalWithItems(projectId: string) {
  const categoriesQuery = useProposalCategories(projectId);
  const itemQueries = useQueries({
    queries: (categoriesQuery.data ?? []).map((category) => ({
      queryKey: proposalKeys.items(category.id),
      queryFn: () => api.proposal.items(category.id),
      enabled: Boolean(category.id && projectId),
    })),
  });

  const categoriesWithItems: ProposalCategoryWithItems[] = (categoriesQuery.data ?? []).map(
    (category, index) => ({
      ...category,
      items: itemQueries[index]?.data ?? [],
    }),
  );

  const isLoading =
    categoriesQuery.isLoading ||
    (categoriesQuery.data !== undefined && itemQueries.some((q) => q.isLoading && !q.data));
  const error = categoriesQuery.error ?? itemQueries.find((q) => q.error)?.error ?? null;

  return { categoriesWithItems, isLoading, error };
}

export function useCreateProposalCategory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProposalCategoryInput) =>
      api.proposal.createCategory(projectId, input),
    onSuccess: (category) => {
      queryClient.setQueryData<ProposalCategory[]>(proposalKeys.categories(projectId), (old) =>
        appendUniqueListItem(old, category),
      );
    },
    onError: (err) => toast.error(`Category save failed: ${err.message}`),
  });
}

export function useUpdateProposalCategory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProposalCategoryInput }) =>
      api.proposal.updateCategory(id, patch),
    onSuccess: (category) => {
      queryClient.setQueryData<ProposalCategory[]>(proposalKeys.categories(projectId), (old) =>
        updateListItem(old, category.id, () => category),
      );
    },
    onError: (err) => toast.error(`Category save failed: ${err.message}`),
  });
}

export function useDeleteProposalCategory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.proposal.deleteCategory(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<ProposalCategory[]>(proposalKeys.categories(projectId), (old) =>
        removeListItem(old, id),
      );
    },
    onError: (err) => toast.error(`Category delete failed: ${err.message}`),
  });
}

export function useCreateProposalItem(categoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProposalItemInput) => api.proposal.createItem(categoryId, input),
    onSuccess: (item) => {
      queryClient.setQueryData<ProposalItem[]>(proposalKeys.items(categoryId), (old) =>
        appendListItem(old, item),
      );
    },
    onError: (err) => toast.error(`Proposal item save failed: ${err.message}`),
  });
}

export function useUpdateProposalItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProposalItemInput }) =>
      api.proposal.updateItem(id, patch),
    onSuccess: (item) => {
      queryClient.setQueryData<ProposalItem[]>(proposalKeys.items(item.categoryId), (old) =>
        updateListItem(old, item.id, () => item),
      );
      void queryClient.invalidateQueries({ queryKey: proposalKeys.changelog(item.id) });
    },
    onError: (err) => toast.error(`Proposal item save failed: ${err.message}`),
  });
}

export function useProposalItemChangelog(itemId: string) {
  return useQuery<ProposalItemChangelogEntry[]>({
    queryKey: proposalKeys.changelog(itemId),
    queryFn: () => api.proposal.itemChangelog(itemId),
    enabled: Boolean(itemId),
  });
}

export function useMoveProposalItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      toCategoryId,
      version,
    }: {
      id: string;
      fromCategoryId: string;
      toCategoryId: string;
      version: number;
    }) => api.proposal.updateItem(id, { categoryId: toCategoryId, version }),
    onMutate: async ({ id, fromCategoryId, toCategoryId }) => {
      const fromKey = proposalKeys.items(fromCategoryId);
      const toKey = proposalKeys.items(toCategoryId);
      const previousFrom = await snapshotQueryList<ProposalItem>(queryClient, fromKey);
      const previousTo = await snapshotQueryList<ProposalItem>(queryClient, toKey);
      const itemToMove = previousFrom?.find((item) => item.id === id);

      queryClient.setQueryData<ProposalItem[]>(fromKey, (old) => removeListItem(old, id));
      if (itemToMove) {
        queryClient.setQueryData<ProposalItem[]>(toKey, (old) =>
          appendListItem(old, { ...itemToMove, categoryId: toCategoryId }),
        );
      }
      return { previousFrom, previousTo };
    },
    onError: (_err, variables, ctx) => {
      restoreQueryList(
        queryClient,
        proposalKeys.items(variables.fromCategoryId),
        ctx?.previousFrom,
      );
      restoreQueryList(queryClient, proposalKeys.items(variables.toCategoryId), ctx?.previousTo);
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: proposalKeys.items(variables.fromCategoryId),
      });
      void queryClient.invalidateQueries({ queryKey: proposalKeys.items(variables.toCategoryId) });
    },
  });
}

export function useDeleteProposalItem(categoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.proposal.deleteItem(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<ProposalItem[]>(proposalKeys.items(categoryId), (old) =>
        removeListItem(old, id),
      );
    },
    onError: (err) => toast.error(`Proposal item delete failed: ${err.message}`),
  });
}
