import { apiFetch } from './transport';
import { mapItemColumnDef, type RawItemColumnDef } from './mappers';
import type { CustomColumnDef } from '../../types';

export type CreateColumnDefInput = {
  label: string;
  sortOrder?: number;
  tableType: 'ffe' | 'proposal';
};

export type UpdateColumnDefInput = {
  label?: string;
  sortOrder?: number;
};

export const columnDefsApi = {
  list: (projectId: string, tableType: 'ffe' | 'proposal'): Promise<CustomColumnDef[]> =>
    apiFetch<{ column_defs: RawItemColumnDef[] }>(
      `/api/v1/projects/${projectId}/column-defs?tableType=${tableType}`,
    ).then((r) => r.column_defs.map(mapItemColumnDef)),

  create: (projectId: string, input: CreateColumnDefInput): Promise<CustomColumnDef> =>
    apiFetch<{ column_def: RawItemColumnDef }>(`/api/v1/projects/${projectId}/column-defs`, {
      method: 'POST',
      body: JSON.stringify({
        label: input.label,
        sort_order: input.sortOrder ?? 0,
        table_type: input.tableType,
      }),
    }).then((r) => mapItemColumnDef(r.column_def)),

  update: (
    projectId: string,
    defId: string,
    patch: UpdateColumnDefInput,
  ): Promise<CustomColumnDef> =>
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
