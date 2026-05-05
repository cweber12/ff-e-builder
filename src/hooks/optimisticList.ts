import type { QueryClient, QueryKey } from '@tanstack/react-query';

type Identifiable = { id: string };

export async function snapshotQueryList<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
): Promise<T[] | undefined> {
  await queryClient.cancelQueries({ queryKey });
  return queryClient.getQueryData<T[]>(queryKey);
}

export function restoreQueryList<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  previous: T[] | undefined,
) {
  if (previous !== undefined) {
    queryClient.setQueryData<T[]>(queryKey, previous);
  }
}

export function appendListItem<T>(old: T[] | undefined, item: T): T[] {
  return [...(old ?? []), item];
}

export function replaceListItem<T extends Identifiable>(
  old: T[] | undefined,
  id: string | undefined,
  item: T,
): T[] {
  return old?.map((candidate) => (candidate.id === id ? item : candidate)) ?? [item];
}

export function updateListItem<T extends Identifiable>(
  old: T[] | undefined,
  id: string,
  update: (item: T) => T,
): T[] {
  return old?.map((item) => (item.id === id ? update(item) : item)) ?? [];
}

export function removeListItem<T extends Identifiable>(old: T[] | undefined, id: string): T[] {
  return old?.filter((item) => item.id !== id) ?? [];
}
