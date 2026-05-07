import { apiFetch, apiFetchResponse } from './transport';
import { mapMeasuredPlan, type RawMeasuredPlan } from './mappers';
import type { MeasuredPlan } from '../../types';

export type CreateMeasuredPlanInput = {
  name: string;
  sheetReference?: string;
  file: File;
};

export const plansApi = {
  list: (projectId: string): Promise<MeasuredPlan[]> =>
    apiFetch<{ plans: RawMeasuredPlan[] }>(`/api/v1/projects/${projectId}/plans`).then((r) =>
      r.plans.map(mapMeasuredPlan),
    ),

  create: (projectId: string, input: CreateMeasuredPlanInput): Promise<MeasuredPlan> => {
    const formData = new FormData();
    formData.set('name', input.name);
    formData.set('sheet_reference', input.sheetReference ?? '');
    formData.set('file', input.file);

    return apiFetch<{ plan: RawMeasuredPlan }>(`/api/v1/projects/${projectId}/plans`, {
      method: 'POST',
      body: formData,
    }).then((r) => mapMeasuredPlan(r.plan));
  },

  delete: (projectId: string, planId: string): Promise<void> =>
    apiFetch<void>(`/api/v1/projects/${projectId}/plans/${planId}`, {
      method: 'DELETE',
    }),

  downloadContent: async (projectId: string, planId: string): Promise<Blob> => {
    const response = await apiFetchResponse(
      `/api/v1/projects/${projectId}/plans/${planId}/content`,
    );
    return response.blob();
  },
};
