import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { ffeKeys, itemKeys, proposalKeys, roomKeys } from '../../lib/query';

export function useRemoveItemFromFfe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.items.delete(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ffeKeys.catalogGroups(projectId) });
      void queryClient.invalidateQueries({ queryKey: proposalKeys.withItems(projectId) });
      void queryClient.invalidateQueries({ queryKey: proposalKeys.categories(projectId) });
      void queryClient.invalidateQueries({ queryKey: roomKeys.forProject(projectId) });
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
    onError: (err) => toast.error(`Remove from FF&E failed: ${err.message}`),
  });
}
