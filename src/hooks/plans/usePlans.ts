import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { removeListItem } from '../optimisticList';
import { planKeys } from '../../lib/query';
import type {
  CreateMeasuredPlanInput,
  UpdatePlanCalibrationInput,
  UpsertPlanLengthLineInput,
  UpsertPlanMeasurementInput,
} from '../../lib/api';
import type { LengthLine, Measurement, MeasuredPlan, PlanCalibration } from '../../types';

export function useMeasuredPlans(projectId: string) {
  return useQuery({
    queryKey: planKeys.forProject(projectId),
    queryFn: () => api.plans.list(projectId),
    enabled: projectId.length > 0,
  });
}

export function useCreateMeasuredPlan(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMeasuredPlanInput) => api.plans.create(projectId, input),
    onSuccess: (created) => {
      queryClient.setQueryData<MeasuredPlan[]>(planKeys.forProject(projectId), (old) => [
        created,
        ...(old ?? []),
      ]);
    },
    onError: (err) => toast.error(`Measured Plan upload failed: ${err.message}`),
  });
}

export function useDeleteMeasuredPlan(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: MeasuredPlan) => api.plans.delete(projectId, plan.id),
    onSuccess: (_data, plan) => {
      queryClient.setQueryData<MeasuredPlan[]>(planKeys.forProject(projectId), (old) =>
        removeListItem(old, plan.id),
      );
    },
    onError: (err) => toast.error(`Measured Plan delete failed: ${err.message}`),
  });
}

export function usePlanCalibration(projectId: string, planId: string) {
  return useQuery({
    queryKey: planKeys.calibration(projectId, planId),
    queryFn: () => api.plans.getCalibration(projectId, planId),
    enabled: projectId.length > 0 && planId.length > 0,
  });
}

export function useSetPlanCalibration(projectId: string, planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePlanCalibrationInput) =>
      api.plans.setCalibration(projectId, planId, input),
    onSuccess: (calibration) => {
      queryClient.setQueryData<PlanCalibration | null>(
        planKeys.calibration(projectId, planId),
        calibration,
      );
      queryClient.setQueryData<MeasuredPlan[]>(planKeys.forProject(projectId), (old) =>
        (old ?? []).map((plan) =>
          plan.id === planId ? { ...plan, calibrationStatus: 'calibrated' } : plan,
        ),
      );
    },
    onError: (err) => toast.error(`Plan calibration save failed: ${err.message}`),
  });
}

export function usePlanLengthLines(projectId: string, planId: string) {
  return useQuery({
    queryKey: planKeys.lengthLines(projectId, planId),
    queryFn: () => api.plans.listLengthLines(projectId, planId),
    enabled: projectId.length > 0 && planId.length > 0,
  });
}

export function useCreatePlanLengthLine(projectId: string, planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertPlanLengthLineInput) =>
      api.plans.createLengthLine(projectId, planId, input),
    onSuccess: (line) => {
      queryClient.setQueryData<LengthLine[]>(planKeys.lengthLines(projectId, planId), (old) => [
        line,
        ...(old ?? []),
      ]);
    },
    onError: (err) => toast.error(`Length Line save failed: ${err.message}`),
  });
}

export function useUpdatePlanLengthLine(projectId: string, planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lineId, input }: { lineId: string; input: UpsertPlanLengthLineInput }) =>
      api.plans.updateLengthLine(projectId, planId, lineId, input),
    onSuccess: (line) => {
      queryClient.setQueryData<LengthLine[]>(planKeys.lengthLines(projectId, planId), (old) =>
        (old ?? []).map((candidate) => (candidate.id === line.id ? line : candidate)),
      );
    },
    onError: (err) => toast.error(`Length Line update failed: ${err.message}`),
  });
}

export function useDeletePlanLengthLine(projectId: string, planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (line: LengthLine) => api.plans.deleteLengthLine(projectId, planId, line.id),
    onSuccess: (_data, line) => {
      queryClient.setQueryData<LengthLine[]>(planKeys.lengthLines(projectId, planId), (old) =>
        removeListItem(old, line.id),
      );
    },
    onError: (err) => toast.error(`Length Line delete failed: ${err.message}`),
  });
}

export function usePlanMeasurements(projectId: string, planId: string) {
  return useQuery({
    queryKey: planKeys.measurements(projectId, planId),
    queryFn: () => api.plans.listMeasurements(projectId, planId),
    enabled: projectId.length > 0 && planId.length > 0,
  });
}

export function useCreatePlanMeasurement(projectId: string, planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertPlanMeasurementInput) =>
      api.plans.createMeasurement(projectId, planId, input),
    onSuccess: (measurement) => {
      queryClient.setQueryData<Measurement[]>(planKeys.measurements(projectId, planId), (old) => [
        measurement,
        ...(old ?? []),
      ]);
      queryClient.setQueryData<MeasuredPlan[]>(planKeys.forProject(projectId), (old) =>
        (old ?? []).map((plan) =>
          plan.id === planId ? { ...plan, measurementCount: plan.measurementCount + 1 } : plan,
        ),
      );
    },
    onError: (err) => toast.error(`Measurement save failed: ${err.message}`),
  });
}

export function useUpdatePlanMeasurement(projectId: string, planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      measurementId,
      input,
    }: {
      measurementId: string;
      input: UpsertPlanMeasurementInput;
    }) => api.plans.updateMeasurement(projectId, planId, measurementId, input),
    onSuccess: (measurement) => {
      queryClient.setQueryData<Measurement[]>(planKeys.measurements(projectId, planId), (old) =>
        (old ?? []).map((candidate) => (candidate.id === measurement.id ? measurement : candidate)),
      );
    },
    onError: (err) => toast.error(`Measurement update failed: ${err.message}`),
  });
}

export function useDeletePlanMeasurement(projectId: string, planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (measurement: Measurement) =>
      api.plans.deleteMeasurement(projectId, planId, measurement.id),
    onSuccess: (_data, measurement) => {
      queryClient.setQueryData<Measurement[]>(planKeys.measurements(projectId, planId), (old) =>
        removeListItem(old, measurement.id),
      );
      queryClient.setQueryData<MeasuredPlan[]>(planKeys.forProject(projectId), (old) =>
        (old ?? []).map((plan) =>
          plan.id === planId
            ? { ...plan, measurementCount: Math.max(0, plan.measurementCount - 1) }
            : plan,
        ),
      );
    },
    onError: (err) => toast.error(`Measurement delete failed: ${err.message}`),
  });
}
