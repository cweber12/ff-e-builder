import { apiFetch } from './transport';
import { mapFinish, type RawFinish } from './mappers';
import type { Finish, MaterialCategory } from '../../types';

export type CreateFinishInput = {
  name: string;
  code?: string;
  description?: string;
  swatchHex?: string;
  manufacturer?: string;
  sourceUrl?: string;
  category?: MaterialCategory | null;
  subCategory?: string;
};

export type UpdateFinishInput = Partial<CreateFinishInput>;

const DEFAULT_SWATCH_HEX = '#D9D4C8';

const finishCreatePayload = (input: CreateFinishInput) => ({
  name: input.name,
  code: input.code ?? '',
  description: input.description ?? '',
  swatch_hex: input.swatchHex ?? DEFAULT_SWATCH_HEX,
  manufacturer: input.manufacturer ?? '',
  source_url: input.sourceUrl ?? '',
  category: input.category ?? null,
  sub_category: input.subCategory ?? '',
});

const finishUpdatePayload = (patch: UpdateFinishInput) => ({
  name: patch.name,
  code: patch.code,
  description: patch.description,
  swatch_hex: patch.swatchHex,
  manufacturer: patch.manufacturer,
  source_url: patch.sourceUrl,
  category: patch.category,
  sub_category: patch.subCategory,
});

export const finishesApi = {
  list: (projectId: string): Promise<Finish[]> =>
    apiFetch<{ finishes: RawFinish[] }>(`/api/v1/projects/${projectId}/finishes`).then((r) =>
      r.finishes.map(mapFinish),
    ),

  create: (projectId: string, input: CreateFinishInput): Promise<Finish> =>
    apiFetch<{ finish: RawFinish }>(`/api/v1/projects/${projectId}/finishes`, {
      method: 'POST',
      body: JSON.stringify(finishCreatePayload(input)),
    }).then((r) => mapFinish(r.finish)),

  update: (id: string, patch: UpdateFinishInput): Promise<Finish> =>
    apiFetch<{ finish: RawFinish }>(`/api/v1/finishes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(finishUpdatePayload(patch)),
    }).then((r) => mapFinish(r.finish)),

  delete: (id: string): Promise<void> =>
    apiFetch<void>(`/api/v1/finishes/${id}`, { method: 'DELETE' }),
};
