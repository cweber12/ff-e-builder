import { apiFetch } from './transport';
import { mapItemColumnDef, type RawItemColumnDef } from './mappers';
import type { ItemColumnDef } from '../../types';

export type CreateItemColumnDefInput = {
  label: string;
  sortOrder?: number;
};

export type UpdateItemColumnDefInput = {
  label?: string;
  sortOrder?: number;
};

export const columnDefsApi = {
  list: (projectId: string): Promise<ItemColumnDef[]> =>
    apiFetch<{ column_defs: RawItemColumnDef[] }>(`/api/v1/projects/${projectId}/column-defs`).then(
      (r) => r.column_defs.map(mapItemColumnDef),
    ),

  create: (projectId: string, input: CreateItemColumnDefInput): Promise<ItemColumnDef> =>
    apiFetch<{ column_def: RawItemColumnDef }>(`/api/v1/projects/${projectId}/column-defs`, {
      method: 'POST',
      body: JSON.stringify({
        label: input.label,
        sort_order: input.sortOrder ?? 0,
      }),
    }).then((r) => mapItemColumnDef(r.column_def)),

  update: (
    projectId: string,
    defId: string,
    patch: UpdateItemColumnDefInput,
  ): Promise<ItemColumnDef> =>
    apiFetch<{ column_def: RawItemColumnDef }>(
      `/api/v1/projects/${projectId}/column-defs/${defId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          label: patch.label,
          sort_order: patch.sortOrder,
        }),
      },
    ).then((r) => mapItemColumnDef(r.column_def)),

  delete: (projectId: string, defId: string): Promise<void> =>
    apiFetch<void>(`/api/v1/projects/${projectId}/column-defs/${defId}`, { method: 'DELETE' }),
};
