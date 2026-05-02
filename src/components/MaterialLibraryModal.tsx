import { useMemo, useState } from 'react';
import {
  useAssignMaterial,
  useCreateAndAssignMaterial,
  useCreateMaterial,
  useDeleteMaterial,
  useMaterials,
  useRemoveMaterialFromItem,
  useUpdateMaterial,
} from '../hooks/useMaterials';
import type { Item, Material } from '../types';
import { Button, Modal } from './primitives';
import { ImageFrame } from './ImageFrame';

type MaterialLibraryModalProps = {
  open: boolean;
  projectId: string;
  roomId: string;
  item?: Item | undefined;
  onClose: () => void;
};

const defaultSwatch = '#D9D4C8';

export function MaterialLibraryModal({
  open,
  projectId,
  roomId,
  item,
  onClose,
}: MaterialLibraryModalProps) {
  const materials = useMaterials(projectId);
  const createMaterial = useCreateMaterial(projectId);
  const updateMaterial = useUpdateMaterial(projectId);
  const deleteMaterial = useDeleteMaterial(projectId);
  const assignMaterial = useAssignMaterial(roomId, projectId);
  const createAndAssignMaterial = useCreateAndAssignMaterial(roomId, projectId);
  const removeMaterial = useRemoveMaterialFromItem(roomId);
  const [draft, setDraft] = useState({
    name: '',
    materialId: '',
    description: '',
    swatches: [defaultSwatch],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const assignedIds = useMemo(
    () => new Set(item?.materials.map((material) => material.id) ?? []),
    [item?.materials],
  );
  const editingMaterial = materials.data?.find((material) => material.id === editingId);

  const resetDraft = () => {
    setDraft({ name: '', materialId: '', description: '', swatches: [defaultSwatch] });
    setEditingId(null);
  };

  const startEdit = (material: Material) => {
    setEditingId(material.id);
    setDraft({
      name: material.name,
      materialId: material.materialId,
      description: material.description,
      swatches: material.swatches.length ? material.swatches : [material.swatchHex],
    });
  };

  const saveDraft = async () => {
    const swatches = normalizeSwatches(draft.swatches);
    const input = {
      name: draft.name.trim(),
      materialId: draft.materialId.trim(),
      description: draft.description.trim(),
      swatchHex: swatches[0] ?? defaultSwatch,
      swatches,
    };
    if (!input.name) return;
    if (editingId) {
      await updateMaterial.mutateAsync({ id: editingId, patch: input });
    } else if (item) {
      await createAndAssignMaterial.mutateAsync({ itemId: item.id, input });
    } else {
      await createMaterial.mutateAsync(input);
    }
    resetDraft();
  };

  const updateSwatch = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      swatches: current.swatches.map((swatch, swatchIndex) =>
        swatchIndex === index ? value : swatch,
      ),
    }));
  };

  const removeSwatch = (index: number) => {
    setDraft((current) => {
      const next = current.swatches.filter((_swatch, swatchIndex) => swatchIndex !== index);
      return { ...current, swatches: next.length ? next : [defaultSwatch] };
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Material library" className="max-w-5xl">
      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section className="rounded-lg border border-gray-200 bg-surface-muted p-4">
          <h3 className="text-sm font-semibold text-gray-950">
            {editingMaterial ? 'Edit material' : 'Add material'}
          </h3>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Name
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                className={inputClassName}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              ID
              <input
                value={draft.materialId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, materialId: event.target.value }))
                }
                className={inputClassName}
              />
            </label>
            <div className="grid gap-2 text-sm font-medium text-gray-700">
              <div className="flex items-center justify-between gap-2">
                <span>Swatches</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:text-gray-400 disabled:no-underline"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      swatches: [...current.swatches, defaultSwatch].slice(0, 12),
                    }))
                  }
                  disabled={draft.swatches.length >= 12}
                >
                  Add swatch
                </button>
              </div>
              <div className="grid gap-2">
                {draft.swatches.map((swatch, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={isHexSwatch(swatch) ? swatch : defaultSwatch}
                      onChange={(event) => updateSwatch(index, event.target.value)}
                      className="h-10 w-12 rounded-md border border-gray-300 bg-white p-1"
                    />
                    <input
                      value={swatch}
                      onChange={(event) => updateSwatch(index, event.target.value)}
                      className={inputClassName}
                      aria-label={`Swatch ${index + 1} hex value`}
                    />
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-white hover:text-danger-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                      onClick={() => removeSwatch(index)}
                      aria-label={`Remove swatch ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Description
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                rows={4}
                className={inputClassName}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetDraft}>
                  Cancel
                </Button>
              )}
              <Button type="button" onClick={() => void saveDraft()} disabled={!draft.name.trim()}>
                {editingId ? 'Save changes' : item ? 'Add and assign' : 'Add material'}
              </Button>
            </div>
          </div>
        </section>

        <section className="min-h-[24rem] overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-950">Project materials</h3>
          </div>
          <div className="max-h-[32rem] overflow-y-auto p-4">
            {materials.isLoading ? (
              <p className="text-sm text-gray-500">Loading materials...</p>
            ) : materials.data?.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {materials.data.map((material) => {
                  const isAssigned = assignedIds.has(material.id);
                  return (
                    <article
                      key={material.id}
                      className="grid gap-3 rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <MaterialSwatches
                          swatches={material.swatches}
                          fallback={material.swatchHex}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-gray-950">
                            {material.name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {material.materialId || 'No material ID'}
                          </p>
                        </div>
                        <ImageFrame
                          entityType="material"
                          entityId={material.id}
                          alt={material.name}
                          className="h-16 w-16 shrink-0"
                          compact
                          placeholderContent={<span className="text-lg text-gray-400">+</span>}
                        />
                      </div>
                      {material.description && (
                        <p className="text-xs leading-5 text-gray-600">{material.description}</p>
                      )}
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(material)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void deleteMaterial.mutateAsync(material.id)}
                          >
                            Delete
                          </Button>
                        </div>
                        {item && (
                          <Button
                            type="button"
                            variant={isAssigned ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => {
                              if (isAssigned) {
                                void removeMaterial.mutateAsync({
                                  itemId: item.id,
                                  materialId: material.id,
                                });
                              } else {
                                void assignMaterial.mutateAsync({
                                  itemId: item.id,
                                  materialId: material.id,
                                });
                              }
                            }}
                          >
                            {isAssigned ? 'Remove' : 'Assign'}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                Add the first project material to build a reusable library.
              </p>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export function MaterialBadges({
  materials,
  onOpen,
}: {
  materials: Material[];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex max-w-60 flex-wrap gap-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      aria-label="Edit item materials"
    >
      {materials.length > 0 ? (
        materials.map((material) => (
          <span
            key={material.id}
            className="inline-flex max-w-full items-center gap-1 rounded-pill border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700"
          >
            <MaterialSwatches
              swatches={material.swatches}
              fallback={material.swatchHex}
              size="sm"
            />
            <span className="truncate">{material.name}</span>
          </span>
        ))
      ) : (
        <span className="text-gray-400">Add materials</span>
      )}
    </button>
  );
}

export function MaterialSwatches({
  swatches,
  fallback,
  size = 'md',
  className = '',
}: {
  swatches: string[];
  fallback: string;
  size?: 'sm' | 'md';
  className?: string | undefined;
}) {
  const visibleSwatches = normalizeSwatches(swatches.length ? swatches : [fallback]);
  const dotClassName = size === 'sm' ? 'h-2.5 w-2.5 rounded-full' : 'h-8 w-8 rounded-md shadow-sm';
  const offsetClassName = size === 'sm' ? '-ml-1.5 first:ml-0' : '-ml-3 first:ml-0';

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      {visibleSwatches.map((swatch, index) => (
        <span
          key={`${swatch}-${index}`}
          className={`${dotClassName} ${offsetClassName} border border-gray-200`}
          style={{ backgroundColor: swatch }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function normalizeSwatches(swatches: string[]) {
  const valid = swatches.filter(isHexSwatch);
  return (valid.length ? valid : [defaultSwatch])
    .filter((swatch, index, array) => array.indexOf(swatch) === index)
    .slice(0, 12);
}

function isHexSwatch(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

const inputClassName =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950 focus:border-brand-500 focus:outline-none';
