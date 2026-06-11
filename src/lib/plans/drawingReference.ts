import type { MeasuredPlan } from '../../types';

export function getMeasuredPlanDrawingReference(
  plan: Pick<MeasuredPlan, 'name' | 'sheetReference'> | null | undefined,
) {
  if (!plan) return null;

  const sheetReference = plan.sheetReference.trim();
  if (sheetReference.length > 0) return sheetReference;

  const name = plan.name.trim();
  return name.length > 0 ? name : null;
}

export function appendDrawingReference(
  existingValue: string | null | undefined,
  reference: string | null | undefined,
) {
  const normalizedReference = reference?.trim();
  const existing = existingValue?.trim() ?? '';
  if (!normalizedReference) return existing;
  if (existing.length === 0) return normalizedReference;

  const existingRefs = existing
    .split(/[,;\n]+/)
    .map((entry) => entry.trim().toLocaleLowerCase())
    .filter(Boolean);

  if (existingRefs.includes(normalizedReference.toLocaleLowerCase())) {
    return existing;
  }

  return `${existing}, ${normalizedReference}`;
}
