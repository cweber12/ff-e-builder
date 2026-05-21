import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { companyKeys } from '../../lib/query';
import type { UpsertCompanyInput } from '../../lib/api';
import type { Company } from '../../types';

export function useCompany() {
  return useQuery({
    queryKey: companyKeys.me,
    queryFn: () => api.company.get(),
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCompanyInput) => api.company.upsert(input),
    onSuccess: (company) => {
      queryClient.setQueryData<Company | null>(companyKeys.me, company);
      toast.success('Company profile saved');
    },
    onError: (err) => toast.error(`Company profile save failed: ${err.message}`),
  });
}
