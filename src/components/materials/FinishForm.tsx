import { useEffect, useRef, useState } from 'react';
import type { MaterialCategory } from '../../types';
import type { FinishDraft } from './MaterialsView';
import { Button } from '../primitives';
import { ImageFrame } from '../shared/image/ImageFrame';

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  wood: 'Wood',
  metal: 'Metal',
  stone: 'Stone',
  glass: 'Glass',
  fabric: 'Fabric',
  solid_color: 'Solid Color',
};

const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'wood',
  'metal',
  'stone',
  'glass',
  'fabric',
  'solid_color',
];

export function FinishForm({
  draft,
  editing,
  editingFinishId,
  submitLabel,
  onDraftChange,
  onCancel,
  onSubmit,
}: {
  draft: FinishDraft;
  editing: boolean;
  editingFinishId?: string | undefined;
  submitLabel: string;
  onDraftChange: (draft: FinishDraft) => void;
  onCancel?: (() => void) | undefined;
  onSubmit: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pasteFlash, setPasteFlash] = useState(false);

  useEffect(() => {
    if (!draft.swatchFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(draft.swatchFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.swatchFile]);

  const onDraftChangeRef = useRef(onDraftChange);
  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      onDraftChangeRef.current({ ...draft, swatchFile: file, swatchMode: 'image' });
      setPasteFlash(true);
      window.setTimeout(() => setPasteFlash(false), 1500);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [draft]);

  const switchMode = (mode: 'color' | 'image') => {
    onDraftChange({
      ...draft,
      swatchMode: mode,
      swatchFile: mode === 'color' ? null : draft.swatchFile,
    });
    if (mode === 'color') setPreviewUrl(null);
  };

  return (
    <section className="border-y border-neutral-200 bg-canvas-shell p-5">
      <p className="eyebrow">{editing ? 'Edit Finish' : 'Add Finish'}</p>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Name
          <input
            value={draft.name}
            onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
            className={inputClassName}
          />
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <label className="grid gap-1 text-sm font-medium text-neutral-700">
            Code
            <input
              value={draft.code}
              onChange={(e) => onDraftChange({ ...draft, code: e.target.value })}
              placeholder="Auto-assigned if blank"
              className={inputClassName}
            />
          </label>
          <div className="grid gap-1 text-sm font-medium text-neutral-700">
            <label htmlFor="finish-category">Category</label>
            <select
              id="finish-category"
              value={draft.category}
              onChange={(e) =>
                onDraftChange({ ...draft, category: e.target.value as MaterialCategory | '' })
              }
              className={inputClassName}
            >
              <option value="">— None —</option>
              {MATERIAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Sub-category
          <input
            value={draft.subCategory}
            onChange={(e) => onDraftChange({ ...draft, subCategory: e.target.value })}
            placeholder="Optional — e.g. Quarter-sawn"
            className={inputClassName}
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Description
          <textarea
            value={draft.description}
            onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
            rows={3}
            className={inputClassName}
          />
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <label className="grid gap-1 text-sm font-medium text-neutral-700">
            Manufacturer
            <input
              value={draft.manufacturer}
              onChange={(e) => onDraftChange({ ...draft, manufacturer: e.target.value })}
              className={inputClassName}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-neutral-700">
            Source URL
            <input
              type="url"
              value={draft.sourceUrl}
              onChange={(e) => onDraftChange({ ...draft, sourceUrl: e.target.value })}
              placeholder="https://…"
              className={inputClassName}
            />
          </label>
        </div>

        <div className="grid gap-2 text-sm font-medium text-neutral-700">
          <span>Swatch</span>
          <div className="grid gap-3">
            <div className="flex h-20 w-20 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-canvas-chrome">
              {draft.swatchMode === 'image' ? (
                previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : editingFinishId ? (
                  <ImageFrame
                    entityType="finish"
                    entityId={editingFinishId}
                    alt="Current swatch"
                    className="h-full w-full border-0 shadow-none"
                    imageClassName="object-cover"
                    compact
                    disabled
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                    No image
                  </span>
                )
              ) : (
                <span
                  className="h-full w-full"
                  style={{ backgroundColor: draft.swatchHex || '#D9D4C8' }}
                />
              )}
            </div>

            <div className="inline-flex self-start border border-neutral-200 bg-canvas-chrome p-0.5">
              <button
                type="button"
                className={draft.swatchMode === 'color' ? activeSwatchToggle : inactiveSwatchToggle}
                onClick={() => switchMode('color')}
              >
                Color
              </button>
              <button
                type="button"
                className={draft.swatchMode === 'image' ? activeSwatchToggle : inactiveSwatchToggle}
                onClick={() => switchMode('image')}
              >
                Image
              </button>
            </div>

            {draft.swatchMode === 'color' ? (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.swatchHex || '#D9D4C8'}
                  onChange={(e) => onDraftChange({ ...draft, swatchHex: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-neutral-200 bg-canvas-chrome p-0.5"
                  aria-label="Swatch color"
                />
                <input
                  type="text"
                  value={draft.swatchHex || ''}
                  onChange={(e) => onDraftChange({ ...draft, swatchHex: e.target.value })}
                  placeholder="#D9D4C8"
                  maxLength={7}
                  className="num w-24 rounded-sm border border-neutral-200 bg-canvas-chrome px-2 py-1.5 text-xs font-normal text-neutral-950 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                  aria-label="Swatch hex value"
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <p className="text-xs font-normal text-neutral-500">
                  {pasteFlash
                    ? 'Pasted image attached.'
                    : draft.swatchFile
                      ? draft.swatchFile.name
                      : 'Upload or paste an image (Ctrl+V).'}
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) =>
                    onDraftChange({ ...draft, swatchFile: e.target.files?.[0] ?? null })
                  }
                  className="input-base file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"
                  aria-label="Swatch image"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="button" onClick={onSubmit} disabled={!draft.name.trim()}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

const inputClassName = 'input-base';

const activeSwatchToggle =
  'rounded-sm bg-brand-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';
const inactiveSwatchToggle =
  'rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';
