import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../primitives';

export type PlanCreateItemDraft = {
  categoryName: string;
  productTag: string;
  description: string;
  location: string;
};

type PlanCreateItemPanelProps = {
  open: boolean;
  categoryOptions: string[];
  defaultCategoryName: string;
  measurementSizeLabel: string;
  measurementAreaLabel: string | null;
  previewUrl: string | null;
  previewLoading: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: PlanCreateItemDraft) => void;
};

export function PlanCreateItemPanel({
  open,
  categoryOptions,
  defaultCategoryName,
  measurementSizeLabel,
  measurementAreaLabel,
  previewUrl,
  previewLoading,
  submitting,
  onClose,
  onSubmit,
}: PlanCreateItemPanelProps) {
  const normalizedOptions = useMemo(() => {
    const next = new Set(categoryOptions.map((name) => name.trim()).filter(Boolean));
    next.add(defaultCategoryName);
    return Array.from(next).sort((a, b) => a.localeCompare(b));
  }, [categoryOptions, defaultCategoryName]);

  const [categoryName, setCategoryName] = useState(defaultCategoryName);
  const [productTag, setProductTag] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!open) return;
    setCategoryName(defaultCategoryName);
    setProductTag('');
    setDescription('');
    setLocation('');
  }, [defaultCategoryName, open]);

  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-label="Create item from measurement"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col overflow-hidden border-l border-neutral-200 bg-canvas-chrome shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Measured Area</p>
          <h2 className="mt-0.5 truncate font-display text-base font-semibold text-neutral-950">
            Add item from measurement
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close create item panel"
          className="icon-btn"
        >
          x
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <section className="space-y-2 rounded-xl border border-neutral-200 bg-white/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Measurement included
          </p>
          <p className="text-sm font-semibold text-neutral-900">{measurementSizeLabel}</p>
          {measurementAreaLabel ? (
            <p className="text-xs text-neutral-600">{measurementAreaLabel}</p>
          ) : null}
        </section>

        <section className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Plan image included
          </p>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {previewLoading ? (
              <div className="flex h-36 items-center justify-center text-xs text-neutral-500">
                Building preview...
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Measured plan preview"
                className="h-36 w-full object-cover"
              />
            ) : (
              <div className="flex h-36 items-center justify-center text-xs text-neutral-500">
                Preview unavailable. The final plan image will still be generated on save.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Category
            </span>
            <select
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-500"
            >
              {normalizedOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Item tag (optional)
            </span>
            <input
              type="text"
              value={productTag}
              onChange={(event) => setProductTag(event.target.value)}
              placeholder="Auto-generated if left blank"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Description (optional)
            </span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Auto-generated if left blank"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Location (optional)
            </span>
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-500"
            />
          </label>

          <p className="text-xs leading-5 text-neutral-500">
            You can save with only category selected. Missing required values are auto-generated and
            the item is added immediately.
          </p>
        </section>
      </div>

      <footer className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() =>
            onSubmit({
              categoryName,
              productTag,
              description,
              location,
            })
          }
          disabled={submitting}
        >
          {submitting ? 'Creating item...' : 'Create item with measurement'}
        </Button>
      </footer>
    </aside>
  );
}
