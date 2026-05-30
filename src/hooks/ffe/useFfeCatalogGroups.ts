import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ffeKeys } from '../../lib/query';

/**
 * FF&E-visible items grouped by Proposal Category, powering the FF&E Catalog and
 * the read-only card list. The FF&E view groups by Proposal Category, not
 * Location (ADR-0012). Empty categories are omitted server-side.
 */
export function useFfeCatalogGroups(projectId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ffeKeys.catalogGroups(projectId),
    queryFn: () => api.items.listFfeGroups(projectId),
    enabled: Boolean(projectId),
  });

  return { groups: data ?? [], isLoading, error: error ?? null };
}
