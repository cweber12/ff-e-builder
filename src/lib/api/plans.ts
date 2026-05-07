import { apiFetch, apiFetchResponse } from './transport';
import {
  mapLengthLine,
  mapMeasuredPlan,
  mapPlanCalibration,
  type RawLengthLine,
  type RawMeasuredPlan,
  type RawPlanCalibration,
} from './mappers';
import type { LengthLine, MeasuredPlan, PlanCalibration, PlanMeasurementUnit } from '../../types';

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

export type UpsertPlanLengthLineInput = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  measuredLengthBase: number | null;
  label?: string | null;
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

  listLengthLines: (projectId: string, planId: string): Promise<LengthLine[]> =>
    apiFetch<{ length_lines: RawLengthLine[] }>(
      `/api/v1/projects/${projectId}/plans/${planId}/length-lines`,
    ).then((r) => r.length_lines.map(mapLengthLine)),

  createLengthLine: (
    projectId: string,
    planId: string,
    input: UpsertPlanLengthLineInput,
  ): Promise<LengthLine> =>
    apiFetch<{ length_line: RawLengthLine }>(
      `/api/v1/projects/${projectId}/plans/${planId}/length-lines`,
      {
        method: 'POST',
        body: JSON.stringify({
          start_x: input.startX,
          start_y: input.startY,
          end_x: input.endX,
          end_y: input.endY,
          measured_length_base: input.measuredLengthBase,
          label: input.label ?? null,
        }),
      },
    ).then((r) => mapLengthLine(r.length_line)),

  updateLengthLine: (
    projectId: string,
    planId: string,
    lineId: string,
    input: UpsertPlanLengthLineInput,
  ): Promise<LengthLine> =>
    apiFetch<{ length_line: RawLengthLine }>(
      `/api/v1/projects/${projectId}/plans/${planId}/length-lines/${lineId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          start_x: input.startX,
          start_y: input.startY,
          end_x: input.endX,
          end_y: input.endY,
          measured_length_base: input.measuredLengthBase,
          label: input.label ?? null,
        }),
      },
    ).then((r) => mapLengthLine(r.length_line)),

  deleteLengthLine: (projectId: string, planId: string, lineId: string): Promise<void> =>
    apiFetch<void>(`/api/v1/projects/${projectId}/plans/${planId}/length-lines/${lineId}`, {
      method: 'DELETE',
    }),

  downloadContent: async (projectId: string, planId: string): Promise<Blob> => {
    const response = await apiFetchResponse(
      `/api/v1/projects/${projectId}/plans/${planId}/content`,
    );
    return response.blob();
  },
};
