import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache is fresh for 30 s; after that a background refetch fires on next access.
      staleTime: 30_000,
      // One automatic retry on transient network errors before surfacing the failure.
      retry: 1,
      // Re-sync when the user tabs back — catches changes made in another tab or device.
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Mutations are not idempotent — never auto-retry.
      retry: 0,
    },
  },
});
