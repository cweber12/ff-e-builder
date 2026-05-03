import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { CreateProjectInput, UpdateProjectInput } from '../../lib/api';
import type { Project } from '../../types';

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: () => api.projects.list(),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.projects.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProjectInput }) =>
      api.projects.update(id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<Project[]>(
        projectKeys.all,
        (old) => old?.map((p) => (p.id === updated.id ? updated : p)) ?? [],
      );
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Project[]>(
        projectKeys.all,
        (old) => old?.filter((p) => p.id !== id) ?? [],
      );
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });
}
