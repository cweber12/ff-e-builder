import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAssignMaterial,
  useCreateAndAssignMaterial,
  useCreateMaterial,
  useMaterials,
  useRemoveMaterialFromItem,
  useUpdateMaterial,
} from '../hooks/useMaterials';
import { imageKeys } from '../hooks/useImages';
import { api } from '../lib/api';
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
  const assignMaterial = useAssignMaterial(roomId, projectId);
  const createAndAssignMaterial = useCreateAndAssignMaterial(roomId, projectId);
  const removeMaterial = useRemoveMaterialFromItem(roomId);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    name: '',
    materialId: '',
    description: '',
    swatchFile: null as File | null,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(null);
  const [addedMaterialName, setAddedMaterialName] = useState<string | null>(null);
  const [removedMaterialName, setRemovedMaterialName] = useState<string | null>(null);
  const assignedIds = useMemo(
    () => new Set(item?.materials.map((material) => material.id) ?? []),
    [item?.materials],
  );
  const priorityIds = useMemo(() => new Set(priorityMaterialIds), [priorityMaterialIds]);
  const editingMaterial = materials.data?.find((material) => material.id === editingId);
  const assignedMaterials = useMemo(
    () => [...(item?.materials ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [item?.materials],
  );
  const visibleMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...(materials.data ?? [])]
      .filter((material) => !assignedIds.has(material.id) && material.id !== pendingAssignmentId)
      .filter((material) => materialMatchesQuery(material, query))
      .sort((a, b) => {
        const prioritySort = Number(priorityIds.has(b.id)) - Number(priorityIds.has(a.id));
        if (prioritySort !== 0) return prioritySort;
        return a.name.localeCompare(b.name);
      });
  }, [assignedIds, materials.data, pendingAssignmentId, priorityIds, searchQuery]);

  const resetDraft = () => {
    setDraft({ name: '', materialId: '', description: '', swatchFile: null });
    setEditingId(null);
  };

  const startEdit = (material: Material) => {
    setEditingId(material.id);
    setDraft({
      name: material.name,
      materialId: material.materialId,
      description: material.description,
      swatchFile: null,
    });
  };

  const saveDraft = async () => {
    const input = {
      name: draft.name.trim(),
      materialId: draft.materialId.trim(),
      description: draft.description.trim(),
    };
    if (!input.name) return;
    let savedMaterial: Material;
    if (editingId) {
      savedMaterial = await updateMaterial.mutateAsync({ id: editingId, patch: input });
    } else if (item) {
      savedMaterial = await createAndAssignMaterial.mutateAsync({ itemId: item.id, input });
      setAddedMaterialName(savedMaterial.name);
      setRemovedMaterialName(null);
    } else {
      savedMaterial = await createMaterial.mutateAsync(input);
    }
    if (draft.swatchFile) {
      await api.images.upload({
        entityType: 'material',
        entityId: savedMaterial.id,
        file: draft.swatchFile,
        altText: savedMaterial.name,
      });
      await queryClient.invalidateQueries({
        queryKey: imageKeys.forEntity('material', savedMaterial.id),
      });
    }
    resetDraft();
  };

  const assignExistingMaterial = async (material: Material) => {
    if (!item || assignedIds.has(material.id) || pendingAssignmentId) return;
    setAddedMaterialName(null);
    setRemovedMaterialName(null);
    setPendingAssignmentId(material.id);
    try {
      const assignedMaterial = await assignMaterial.mutateAsync({
        itemId: item.id,
        materialId: material.id,
      });
      setAddedMaterialName(assignedMaterial.name);
    } finally {
      setPendingAssignmentId(null);
    }
  };

  const removeAssignedMaterial = async (material: Material) => {
    if (!item) return;
    await removeMaterial.mutateAsync({
      itemId: item.id,
      materialId: material.id,
    });
    setAddedMaterialName(null);
    setRemovedMaterialName(material.name);
  };

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <MaterialForm
        draft={draft}
        editing={Boolean(editingMaterial)}
        submitLabel={editingId ? 'Save changes' : item ? 'Add and assign' : 'Add material'}
        onDraftChange={setDraft}
        onCancel={editingId ? resetDraft : undefined}
        onSubmit={() => void saveDraft()}
      />

      <section className="flex min-h-[24rem] max-h-[34rem] min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid gap-3 border-b border-gray-100 px-4 py-3">
          <h3 className="min-w-0 text-sm font-semibold text-gray-950">Project materials</h3>
          {item && (
            <div className="grid min-w-0 gap-3 rounded-lg border border-gray-200 bg-surface-muted p-3">
              <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Assigned to item
                </span>
                <span className="text-xs font-medium text-gray-600">
                  {assignedMaterials.length} selected
                </span>
              </div>
              {assignedMaterials.length ? (
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  {assignedMaterials.map((material) => (
                    <span
                      key={material.id}
                      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm"
                    >
                      <MaterialSwatchImage material={material} size="sm" />
                      <span className="min-w-0 truncate">{material.name}</span>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 font-semibold text-danger-700 hover:bg-danger-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                        onClick={() => void removeAssignedMaterial(material)}
                        aria-label={`Remove ${material.name} from item`}
                      >
                        Remove
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No materials assigned yet.</p>
              )}
              {removedMaterialName && (
                <p role="status" className="text-xs font-medium text-danger-700">
                  Removed {removedMaterialName} from this item.
                </p>
              )}
              {addedMaterialName && (
                <p role="status" className="text-xs font-medium text-brand-700">
                  Added {addedMaterialName} to this item.
                </p>
              )}
            </div>
          )}
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search materials"
            className={`${inputClassName} min-w-0`}
            aria-label="Search project materials"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
          {materials.isLoading ? (
            <p className="text-sm text-gray-500">Loading materials...</p>
          ) : visibleMaterials.length ? (
            <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
              {visibleMaterials.map((material) => (
                <MaterialPickerCard
                  key={material.id}
                  material={material}
                  assigning={pendingAssignmentId === material.id}
                  assignable={Boolean(item)}
                  onSelect={() => void assignExistingMaterial(material)}
                  onEdit={() => startEdit(material)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              {searchQuery.trim()
                ? 'No available materials match the current search.'
                : item
                  ? 'All project materials are already assigned to this item.'
                  : 'Add the first project material to build a reusable library.'}
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
  swatchFile: File | null;
};

export function MaterialForm({
  draft,
  editing,
  submitLabel,
  onDraftChange,
  onCancel,
  onSubmit,
}: {
  draft: MaterialDraft;
  editing: boolean;
  submitLabel: string;
  onDraftChange: (updater: (current: MaterialDraft) => MaterialDraft) => void;
  onCancel?: (() => void) | undefined;
  onSubmit: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.swatchFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(draft.swatchFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.swatchFile]);

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
        <label className="grid gap-2 text-sm font-medium text-gray-700">
          Swatch image
          <div className="grid gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-medium text-gray-400">
                    Image
                  </span>
                )}
              </span>
              <span className="min-w-0 text-xs font-normal text-gray-500">
                {draft.swatchFile?.name ?? 'Upload the material swatch image.'}
              </span>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  swatchFile: event.target.files?.[0] ?? null,
                }))
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700 focus:border-brand-500 focus:outline-none"
              aria-label="Swatch image"
            />
          </div>
        </label>
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
  assigning,
  assignable,
  onSelect,
  onEdit,
}: {
  material: Material;
  assigning: boolean;
  assignable: boolean;
  onSelect: () => void;
  onEdit: () => void;
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
      aria-label={assignable ? `Add ${material.name} to item` : `View ${material.name}`}
      aria-busy={assigning}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="group min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:border-brand-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
      <div className="grid min-w-0 gap-2 p-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-gray-950">{material.name}</h4>
          <p className="truncate text-xs text-gray-500">
            {material.materialId || 'No material ID'}
          </p>
        </div>
        <MaterialSwatchImage material={material} size="sm" />
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
          <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
            {assigning ? 'Adding...' : assignable ? 'Click to add' : 'Library item'}
          </span>
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
          </div>
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
            <MaterialSwatchImage material={material} size="sm" />
            <span className="truncate">{material.name}</span>
          </span>
        ))
      ) : (
        <span className="text-gray-400">Add materials</span>
      )}
    </button>
  );
}

export function MaterialSwatchImage({
  material,
  size = 'md',
  className = '',
}: {
  material: Material;
  size?: 'sm' | 'md';
  className?: string | undefined;
}) {
  const frameClassName = size === 'sm' ? 'h-6 w-6 rounded-full' : 'h-10 w-10 rounded-full';
  return (
    <ImageFrame
      entityType="material"
      entityId={material.id}
      alt={`${material.name} swatch`}
      className={`${frameClassName} shrink-0 border-gray-200 shadow-none ${className}`}
      imageClassName="object-cover"
      placeholderClassName="bg-white"
      placeholderContent={<span className="text-[10px] font-semibold text-gray-400">IMG</span>}
      compact
      disabled
    />
  );
}

function materialMatchesQuery(material: Material, query: string) {
  if (!query) return true;
  return [material.name, material.materialId, material.description]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

const inputClassName =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950 focus:border-brand-500 focus:outline-none';
