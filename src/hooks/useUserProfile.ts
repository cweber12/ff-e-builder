import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { UpsertUserProfileInput } from '../lib/api';
import type { UserProfile } from '../types';

export const userProfileKeys = {
  me: ['user-profile', 'me'] as const,
};

export function useUserProfile() {
  return useQuery({
    queryKey: userProfileKeys.me,
    queryFn: () => api.users.me(),
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertUserProfileInput) => api.users.updateMe(input),
    onSuccess: (profile) => {
      queryClient.setQueryData<UserProfile>(userProfileKeys.me, profile);
      toast.success('User information saved');
    },
    onError: (err) => toast.error(`User information save failed: ${err.message}`),
  });
}
