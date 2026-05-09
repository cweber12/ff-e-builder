/**
 * @deprecated Use useColumnDefs / useCreateColumnDef / useUpdateColumnDef / useDeleteColumnDef
 * from src/hooks/shared instead. This file re-exports them scoped to tableType='ffe' for
 * backward compatibility during the migration to the shared column-def system.
 */
import {
  useColumnDefs,
  useCreateColumnDef,
  useUpdateColumnDef,
  useDeleteColumnDef,
} from '../shared/useColumnDefs';
import type { CreateColumnDefInput, UpdateColumnDefInput } from '../../lib/api/columnDefs';

export type CreateItemColumnDefInput = Omit<CreateColumnDefInput, 'tableType'>;
export type UpdateItemColumnDefInput = UpdateColumnDefInput;

export function useItemColumnDefs(projectId: string) {
  return useColumnDefs(projectId, 'ffe');
}

export function useCreateItemColumnDef(projectId: string) {
  return useCreateColumnDef(projectId, 'ffe');
}

export function useUpdateItemColumnDef(projectId: string) {
  return useUpdateColumnDef(projectId, 'ffe');
}

export function useDeleteItemColumnDef(projectId: string) {
  return useDeleteColumnDef(projectId, 'ffe');
}
