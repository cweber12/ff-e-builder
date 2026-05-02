import { useMemo, useState, type KeyboardEvent } from 'react';
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
  priorityMaterialIds?: string[] | undefined;
  onClose: () => void;
};

const defaultSwatch = '#D9D4C8';

export function MaterialLibraryModal({
  open,
  projectId,
  roomId,
  item,
  priorityMaterialIds = [],
  onClose,
}: MaterialLibraryModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Material library" className="max-w-5xl">
      <MaterialLibraryPanel
        projectId={projectId}
        roomId={roomId}
        item={item}
        priorityMaterialIds={priorityMaterialIds}
      />
    </Modal>
  );
}

export function MaterialLibraryPanel({
  projectId,
  roomId,
  item,
  priorityMaterialIds = [],
}: Omit<MaterialLibraryModalProps, 'open' | 'onClose'>) {
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
  const [searchQuery, setSearchQuery] = useState('');
  const assignedIds = useMemo(
    () => new Set(item?.materials.map((material) => material.id) ?? []),
    [item?.materials],
  );
  const priorityIds = useMemo(() => new Set(priorityMaterialIds), [priorityMaterialIds]);
  const editingMaterial = materials.data?.find((material) => material.id === editingId);
  const visibleMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...(materials.data ?? [])]
      .filter((material) => materialMatchesQuery(material, query))
      .sort((a, b) => {
        const assignedSort = Number(assignedIds.has(b.id)) - Number(assignedIds.has(a.id));
        if (assignedSort !== 0) return assignedSort;
        const prioritySort = Number(priorityIds.has(b.id)) - Number(priorityIds.has(a.id));
        if (prioritySort !== 0) return prioritySort;
        return a.name.localeCompare(b.name);
      });
  }, [assignedIds, materials.data, priorityIds, searchQuery]);

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
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <MaterialForm
        draft={draft}
        editing={Boolean(editingMaterial)}
        submitLabel={editingId ? 'Save changes' : item ? 'Add and assign' : 'Add material'}
        onDraftChange={setDraft}
        onUpdateSwatch={updateSwatch}
        onRemoveSwatch={removeSwatch}
        onAddSwatch={() =>
          setDraft((current) => ({
            ...current,
            swatches: [...current.swatches, defaultSwatch].slice(0, 12),
          }))
        }
        onCancel={editingId ? resetDraft : undefined}
        onSubmit={() => void saveDraft()}
      />

      <section className="flex min-h-[24rem] max-h-[34rem] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid gap-3 border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-950">Project materials</h3>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search materials"
            className={inputClassName}
            aria-label="Search project materials"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {materials.isLoading ? (
            <p className="text-sm text-gray-500">Loading materials...</p>
          ) : visibleMaterials.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
              {visibleMaterials.map((material) => {
                const isAssigned = assignedIds.has(material.id);
                return (
                  <MaterialPickerCard
                    key={material.id}
                    material={material}
                    selected={isAssigned}
                    onSelect={() => {
                      if (!item || isAssigned) return;
                      void assignMaterial.mutateAsync({
                        itemId: item.id,
                        materialId: material.id,
                      });
                    }}
                    onEdit={() => startEdit(material)}
                    onDelete={() => void deleteMaterial.mutateAsync(material.id)}
                    onRemove={
                      item && isAssigned
                        ? () =>
                            void removeMaterial.mutateAsync({
                              itemId: item.id,
                              materialId: material.id,
                            })
                        : undefined
                    }
                  />
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
  );
}

type MaterialDraft = {
  name: string;
  materialId: string;
  description: string;
  swatches: string[];
};

export function MaterialForm({
  draft,
  editing,
  submitLabel,
  onDraftChange,
  onUpdateSwatch,
  onRemoveSwatch,
  onAddSwatch,
  onCancel,
  onSubmit,
}: {
  draft: MaterialDraft;
  editing: boolean;
  submitLabel: string;
  onDraftChange: (updater: (current: MaterialDraft) => MaterialDraft) => void;
  onUpdateSwatch: (index: number, value: string) => void;
  onRemoveSwatch: (index: number) => void;
  onAddSwatch: () => void;
  onCancel?: (() => void) | undefined;
  onSubmit: () => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-surface-muted p-4">
      <h3 className="text-sm font-semibold text-gray-950">
        {editing ? 'Edit material' : 'Add material'}
      </h3>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          Name
          <input
            value={draft.name}
            onChange={(event) =>
              onDraftChange((current) => ({ ...current, name: event.target.value }))
            }
            className={inputClassName}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          ID
          <input
            value={draft.materialId}
            onChange={(event) =>
              onDraftChange((current) => ({ ...current, materialId: event.target.value }))
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
              onClick={onAddSwatch}
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
                  onChange={(event) => onUpdateSwatch(index, event.target.value)}
                  className="h-10 w-12 rounded-md border border-gray-300 bg-white p-1"
                />
                <input
                  value={swatch}
                  onChange={(event) => onUpdateSwatch(index, event.target.value)}
                  className={inputClassName}
                  aria-label={`Swatch ${index + 1} hex value`}
                />
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-white hover:text-danger-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  onClick={() => onRemoveSwatch(index)}
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
              onDraftChange((current) => ({ ...current, description: event.target.value }))
            }
            rows={4}
            className={inputClassName}
          />
        </label>
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

function MaterialPickerCard({
  material,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onRemove,
}: {
  material: Material;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRemove?: (() => void) | undefined;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`group overflow-hidden rounded-lg border bg-white text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${
        selected
          ? 'border-brand-500 ring-1 ring-brand-500'
          : 'border-gray-200 hover:border-brand-400 hover:shadow-md'
      }`}
    >
      <ImageFrame
        entityType="material"
        entityId={material.id}
        alt={material.name}
        className="h-28 w-full rounded-none border-0 shadow-none"
        imageClassName="object-cover"
        compact
        placeholderContent={<span className="text-lg text-gray-400">+</span>}
        disabled
      />
      <div className="grid gap-2 p-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-gray-950">{material.name}</h4>
          <p className="truncate text-xs text-gray-500">
            {material.materialId || 'No material ID'}
          </p>
        </div>
        <MaterialSwatches swatches={material.swatches} fallback={material.swatchHex} size="sm" />
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </Button>
          </div>
          {selected && onRemove && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </article>
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

function materialMatchesQuery(material: Material, query: string) {
  if (!query) return true;
  return [
    material.name,
    material.materialId,
    material.description,
    material.swatchHex,
    ...material.swatches,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

const inputClassName =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950 focus:border-brand-500 focus:outline-none';
