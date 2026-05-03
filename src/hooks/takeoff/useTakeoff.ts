import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type {
  CreateTakeoffCategoryInput,
  CreateTakeoffItemInput,
  UpdateTakeoffCategoryInput,
  UpdateTakeoffItemInput,
} from '../../lib/api';
import type { TakeoffCategory, TakeoffCategoryWithItems, TakeoffItem } from '../../types';

export const takeoffKeys = {
  categories: (projectId: string) => ['takeoff', projectId, 'categories'] as const,
  items: (categoryId: string) => ['takeoff', 'category', categoryId, 'items'] as const,
};

export function useTakeoffCategories(projectId: string) {
  return useQuery({
    queryKey: takeoffKeys.categories(projectId),
    queryFn: () => api.takeoff.categories(projectId),
    enabled: Boolean(projectId),
  });
}

export function useTakeoffWithItems(projectId: string) {
  const categoriesQuery = useTakeoffCategories(projectId);
  const itemQueries = useQueries({
    queries: (categoriesQuery.data ?? []).map((category) => ({
      queryKey: takeoffKeys.items(category.id),
      queryFn: () => api.takeoff.items(category.id),
      enabled: Boolean(category.id && projectId),
    })),
  });

  const categoriesWithItems: TakeoffCategoryWithItems[] = (categoriesQuery.data ?? []).map(
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

export function useCreateTakeoffCategory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTakeoffCategoryInput) => api.takeoff.createCategory(projectId, input),
    onSuccess: (category) => {
      queryClient.setQueryData<TakeoffCategory[]>(takeoffKeys.categories(projectId), (old) =>
        old?.some((c) => c.id === category.id) ? old : [...(old ?? []), category],
      );
    },
    onError: (err) => toast.error(`Category save failed: ${err.message}`),
  });
}

export function useUpdateTakeoffCategory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTakeoffCategoryInput }) =>
      api.takeoff.updateCategory(id, patch),
    onSuccess: (category) => {
      queryClient.setQueryData<TakeoffCategory[]>(
        takeoffKeys.categories(projectId),
        (old) =>
          old?.map((candidate) => (candidate.id === category.id ? category : candidate)) ?? [],
      );
    },
    onError: (err) => toast.error(`Category save failed: ${err.message}`),
  });
}

export function useDeleteTakeoffCategory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.takeoff.deleteCategory(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<TakeoffCategory[]>(
        takeoffKeys.categories(projectId),
        (old) => old?.filter((category) => category.id !== id) ?? [],
      );
    },
    onError: (err) => toast.error(`Category delete failed: ${err.message}`),
  });
}

export function useCreateTakeoffItem(categoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTakeoffItemInput) => api.takeoff.createItem(categoryId, input),
    onSuccess: (item) => {
      queryClient.setQueryData<TakeoffItem[]>(takeoffKeys.items(categoryId), (old) => [
        ...(old ?? []),
        item,
      ]);
    },
    onError: (err) => toast.error(`Take-off item save failed: ${err.message}`),
  });
}

export function useUpdateTakeoffItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTakeoffItemInput }) =>
      api.takeoff.updateItem(id, patch),
    onSuccess: (item) => {
      queryClient.setQueryData<TakeoffItem[]>(
        takeoffKeys.items(item.categoryId),
        (old) => old?.map((candidate) => (candidate.id === item.id ? item : candidate)) ?? [],
      );
    },
    onError: (err) => toast.error(`Take-off item save failed: ${err.message}`),
  });
}

export function useDeleteTakeoffItem(categoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.takeoff.deleteItem(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<TakeoffItem[]>(
        takeoffKeys.items(categoryId),
        (old) => old?.filter((item) => item.id !== id) ?? [],
      );
    },
    onError: (err) => toast.error(`Take-off item delete failed: ${err.message}`),
  });
}
