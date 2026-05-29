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
const DEFAULT_FINISH_NAME_PREFIX = 'Finish';
const DEFAULT_NAME_INDEX_PADDING = 3;

function parseDefaultNameIndex(name: string, prefix: string): number | null {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = name.match(new RegExp(`^${escapedPrefix}\\s+(\\d+)$`, 'i'));
  if (!match) return null;
  const capturedIndex = match[1];
  if (capturedIndex === undefined) return null;
  const parsed = Number.parseInt(capturedIndex, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDefaultFinishName(index: number) {
  const suffix = String(index).padStart(DEFAULT_NAME_INDEX_PADDING, '0');
  return `${DEFAULT_FINISH_NAME_PREFIX} ${suffix}`;
}

export function nextDefaultFinishName(finishes: readonly Pick<Finish, 'name'>[] | undefined) {
  const maxExisting = (finishes ?? []).reduce((currentMax, finish) => {
    const parsed = parseDefaultNameIndex(finish.name.trim(), DEFAULT_FINISH_NAME_PREFIX);
    return parsed === null ? currentMax : Math.max(currentMax, parsed);
  }, 0);
  return formatDefaultFinishName(maxExisting + 1);
}

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
