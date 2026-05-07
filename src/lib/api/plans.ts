import { apiFetch, apiFetchResponse } from './transport';
import {
  mapLengthLine,
  mapMeasuredPlan,
  mapMeasurement,
  mapPlanCalibration,
  type RawLengthLine,
  type RawMeasuredPlan,
  type RawMeasurement,
  type RawPlanCalibration,
} from './mappers';
import type {
  LengthLine,
  Measurement,
  MeasuredPlan,
  PlanCalibration,
  PlanMeasurementUnit,
} from '../../types';

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

export type UpsertPlanMeasurementInput = {
  targetKind: Measurement['targetKind'];
  targetItemId: string;
  targetTagSnapshot: string;
  rectX: number;
  rectY: number;
  rectWidth: number;
  rectHeight: number;
  horizontalSpanBase: number;
  verticalSpanBase: number;
  cropX?: number | null;
  cropY?: number | null;
  cropWidth?: number | null;
  cropHeight?: number | null;
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

  listMeasurements: (projectId: string, planId: string): Promise<Measurement[]> =>
    apiFetch<{ measurements: RawMeasurement[] }>(
      `/api/v1/projects/${projectId}/plans/${planId}/measurements`,
    ).then((r) => r.measurements.map(mapMeasurement)),

  createMeasurement: (
    projectId: string,
    planId: string,
    input: UpsertPlanMeasurementInput,
  ): Promise<Measurement> =>
    apiFetch<{ measurement: RawMeasurement }>(
      `/api/v1/projects/${projectId}/plans/${planId}/measurements`,
      {
        method: 'POST',
        body: JSON.stringify({
          target_kind: input.targetKind,
          target_item_id: input.targetItemId,
          target_tag_snapshot: input.targetTagSnapshot,
          rect_x: input.rectX,
          rect_y: input.rectY,
          rect_width: input.rectWidth,
          rect_height: input.rectHeight,
          horizontal_span_base: input.horizontalSpanBase,
          vertical_span_base: input.verticalSpanBase,
          crop_x: input.cropX ?? null,
          crop_y: input.cropY ?? null,
          crop_width: input.cropWidth ?? null,
          crop_height: input.cropHeight ?? null,
        }),
      },
    ).then((r) => mapMeasurement(r.measurement)),

  updateMeasurement: (
    projectId: string,
    planId: string,
    measurementId: string,
    input: UpsertPlanMeasurementInput,
  ): Promise<Measurement> =>
    apiFetch<{ measurement: RawMeasurement }>(
      `/api/v1/projects/${projectId}/plans/${planId}/measurements/${measurementId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          target_kind: input.targetKind,
          target_item_id: input.targetItemId,
          target_tag_snapshot: input.targetTagSnapshot,
          rect_x: input.rectX,
          rect_y: input.rectY,
          rect_width: input.rectWidth,
          rect_height: input.rectHeight,
          horizontal_span_base: input.horizontalSpanBase,
          vertical_span_base: input.verticalSpanBase,
          crop_x: input.cropX ?? null,
          crop_y: input.cropY ?? null,
          crop_width: input.cropWidth ?? null,
          crop_height: input.cropHeight ?? null,
        }),
      },
    ).then((r) => mapMeasurement(r.measurement)),

  deleteMeasurement: (projectId: string, planId: string, measurementId: string): Promise<void> =>
    apiFetch<void>(`/api/v1/projects/${projectId}/plans/${planId}/measurements/${measurementId}`, {
      method: 'DELETE',
    }),

  downloadContent: async (projectId: string, planId: string): Promise<Blob> => {
    const response = await apiFetchResponse(
      `/api/v1/projects/${projectId}/plans/${planId}/content`,
    );
    return response.blob();
  },
};
