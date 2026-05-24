import { useCallback, useRef } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { itemKeys, projectKeys, proposalKeys, roomKeys } from '../../lib/query';
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
  ProposalRevision,
  RevisionSnapshot,
} from '../../types';

export function useProposalCategories(projectId: string) {
  return useQuery({
    queryKey: proposalKeys.categories(projectId),
    queryFn: () => api.proposal.categories(projectId),
    enabled: Boolean(projectId),
  });
}

// Five minutes — long enough to avoid redundant refetches during a session,
// short enough that a hard-refresh or tab-switch picks up server changes.
const ITEMS_STALE_MS = 5 * 60 * 1000;

export function useProposalWithItems(projectId: string, collapsedCategoryIds: ReadonlySet<string>) {
  // Capture collapsed state at mount time so the combined query key stays
  // stable even as the user collapses/expands categories during the session.
  const initialCollapsedRef = useRef(collapsedCategoryIds);

  const combinedQuery = useQuery({
    queryKey: proposalKeys.withItems(projectId),
    queryFn: () => api.proposal.withItems(projectId, [...initialCollapsedRef.current]),
    enabled: Boolean(projectId),
    staleTime: ITEMS_STALE_MS,
  });

  const categories = combinedQuery.data?.categories ?? [];
  const seedItems = combinedQuery.data?.items ?? {};

  // Per-category queries subscribe to the per-category cache so mutations
  // (setQueryData / invalidateQueries keyed on proposalKeys.items) remain
  // reactive.  initialData + initialDataUpdatedAt seeds them from the combined
  // response without firing extra network requests.
  const itemQueries = useQueries({
    queries: categories.map((cat) => ({
      queryKey: proposalKeys.items(cat.id),
      queryFn: () => api.proposal.items(cat.id),
      enabled: !collapsedCategoryIds.has(cat.id),
      initialData: seedItems[cat.id],
      initialDataUpdatedAt: combinedQuery.dataUpdatedAt,
      staleTime: ITEMS_STALE_MS,
    })),
  });

  const categoriesWithItems: ProposalCategoryWithItems[] = categories.map((category, index) => ({
    ...category,
    items: itemQueries[index]?.data ?? [],
  }));

  const isLoading =
    combinedQuery.isLoading ||
    (categories.length > 0 && itemQueries.some((q) => q.isLoading && !q.data));
  const error = combinedQuery.error ?? itemQueries.find((q) => q.error)?.error ?? null;

  return { categoriesWithItems, isLoading, error };
}

export function usePrefetchProposalItems() {
  const queryClient = useQueryClient();
  return useCallback(
    (categoryId: string) => {
      void queryClient.prefetchQuery({
        queryKey: proposalKeys.items(categoryId),
        queryFn: () => api.proposal.items(categoryId),
        staleTime: ITEMS_STALE_MS,
      });
    },
    [queryClient],
  );
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
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateProposalItemInput;
      /** Required when patch.changeLog.isPriceAffecting may be true so the
       *  revision block and proposal status are refreshed after the API
       *  opens (or updates) a Revision Round. */
      projectId?: string;
    }) => api.proposal.updateItem(id, patch),
    onSuccess: (item, { patch, projectId }) => {
      queryClient.setQueryData<ProposalItem[]>(proposalKeys.items(item.categoryId), (old) =>
        updateListItem(old, item.id, () => item),
      );
      void queryClient.invalidateQueries({ queryKey: proposalKeys.changelog(item.id) });
      // Any confirmed change (price-affecting or notes-only) must refresh the
      // revision block so the Notes column stays up to date.
      if (patch.changeLog && projectId) {
        void queryClient.invalidateQueries({ queryKey: proposalKeys.revisions(projectId) });
      }
      // Only a price-affecting change can open a Revision Round and revert
      // proposal_status to in_progress — refresh project cache for status badge.
      if (patch.changeLog?.isPriceAffecting && projectId) {
        void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      }
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

export function useAddProposalItemToFfe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.proposal.addItemToFfe(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomKeys.forProject(projectId) });
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
    onError: (err) => toast.error(`Add to FF&E failed: ${err.message}`),
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

// ─── Revision Rounds ────────────────────────────────────────────────────────

export function useProposalRevisions(projectId: string) {
  return useQuery<{
    revisions: ProposalRevision[];
    snapshots: RevisionSnapshot[];
    changelog: ProposalItemChangelogEntry[];
  }>({
    queryKey: proposalKeys.revisions(projectId),
    queryFn: () => api.proposal.revisions(projectId),
    enabled: Boolean(projectId),
  });
}

export function useUpdateRevisionItemCost(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      revisionId,
      itemId,
      unitCostCents,
    }: {
      revisionId: string;
      itemId: string;
      unitCostCents: number;
    }) => api.proposal.updateRevisionItemCost(revisionId, itemId, unitCostCents),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: proposalKeys.revisions(projectId) });
    },
    onError: (err) => toast.error(`Revision cost update failed: ${err.message}`),
  });
}

export function useReorderProposalItems(categoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedItemIds: string[]) => api.proposal.reorderItems(categoryId, orderedItemIds),
    onMutate: async (orderedItemIds) => {
      const queryKey = proposalKeys.items(categoryId);
      const previous = await snapshotQueryList<ProposalItem>(queryClient, queryKey);
      const indexMap = new Map(orderedItemIds.map((id, i) => [id, i]));
      queryClient.setQueryData<ProposalItem[]>(queryKey, (old) => {
        if (!old) return old;
        return [...old].sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      restoreQueryList(queryClient, proposalKeys.items(categoryId), ctx?.previous);
      toast.error('Reorder failed — order restored');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: proposalKeys.items(categoryId) }),
  });
}
