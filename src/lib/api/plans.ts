import { apiFetch, apiFetchResponse } from './transport';
import {
  mapMeasuredPlan,
  mapPlanCalibration,
  type RawMeasuredPlan,
  type RawPlanCalibration,
} from './mappers';
import type { MeasuredPlan, PlanCalibration, PlanMeasurementUnit } from '../../types';

export type CreateMeasuredPlanInput = {
  name: string;
  sheetReference?: string;
  file: File;
};

export type UpdatePlanCalibrationInput = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  realWorldLength: number;
  unit: PlanMeasurementUnit;
  pixelsPerUnit: number;
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

  getCalibration: (projectId: string, planId: string): Promise<PlanCalibration | null> =>
    apiFetch<{ calibration: RawPlanCalibration | null }>(
      `/api/v1/projects/${projectId}/plans/${planId}/calibration`,
    ).then((r) => (r.calibration ? mapPlanCalibration(r.calibration) : null)),

  setCalibration: (
    projectId: string,
    planId: string,
    input: UpdatePlanCalibrationInput,
  ): Promise<PlanCalibration> =>
    apiFetch<{ calibration: RawPlanCalibration }>(
      `/api/v1/projects/${projectId}/plans/${planId}/calibration`,
      {
        method: 'PUT',
        body: JSON.stringify({
          start_x: input.startX,
          start_y: input.startY,
          end_x: input.endX,
          end_y: input.endY,
          real_world_length: input.realWorldLength,
          unit: input.unit,
          pixels_per_unit: input.pixelsPerUnit,
        }),
      },
    ).then((r) => mapPlanCalibration(r.calibration)),

  downloadContent: async (projectId: string, planId: string): Promise<Blob> => {
    const response = await apiFetchResponse(
      `/api/v1/projects/${projectId}/plans/${planId}/content`,
    );
    return response.blob();
  },
};
