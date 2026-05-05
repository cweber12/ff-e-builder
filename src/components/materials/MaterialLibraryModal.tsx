import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAssignMaterial,
  useAssignMaterialToProposalItem,
  useCreateAndAssignMaterial,
  useCreateAndAssignMaterialToProposalItem,
  useCreateMaterial,
  useMaterials,
  useRemoveMaterialFromItem,
  useRemoveMaterialFromProposalItem,
  useUpdateMaterial,
  useUpdateMaterialForItem,
  useUpdateMaterialForProposalItem,
} from '../../hooks/materials/useMaterials';
import { imageKeys } from '../../hooks/shared/useImages';
import { api } from '../../lib/api';
import type { Item, Material, ProposalItem } from '../../types';
import { Button, Modal } from '../primitives';
import { ImageFrame } from '../shared/ImageFrame';

type FfeContext = {
  context: 'ffe';
  item?: Item | undefined;
  roomId: string;
};

type ProposalContext = {
  context: 'proposal';
  item?: ProposalItem | undefined;
  categoryId: string;
};

type MaterialLibraryModalProps = {
  open: boolean;
  projectId: string;
  priorityMaterialIds?: string[] | undefined;
  onClose: () => void;
} & (FfeContext | ProposalContext);

export function MaterialLibraryModal(props: MaterialLibraryModalProps) {
  const { open, onClose } = props;
  return (
    <Modal open={open} onClose={onClose} title="Finish Library" className="max-w-5xl">
      <MaterialLibraryPanel {...props} />
    </Modal>
  );
}

type MaterialLibraryPanelProps =
  | ({
      projectId: string;
      priorityMaterialIds?: string[] | undefined;
    } & FfeContext)
  | ({
      projectId: string;
      priorityMaterialIds?: string[] | undefined;
    } & ProposalContext);

export function MaterialLibraryPanel(props: MaterialLibraryPanelProps) {
  const { projectId, priorityMaterialIds = [] } = props;
  const roomId = props.context === 'ffe' ? props.roomId : '';
  const categoryId = props.context === 'proposal' ? props.categoryId : '';
  const activeItem: Item | ProposalItem | undefined = props.item;

  const materials = useMaterials(projectId);
  const createMaterial = useCreateMaterial(projectId);
  const updateMaterial = useUpdateMaterial(projectId);
  const assignMaterial = useAssignMaterial(roomId, projectId);
  const assignToProposal = useAssignMaterialToProposalItem(categoryId, projectId);
  const createAndAssignMaterial = useCreateAndAssignMaterial(roomId, projectId);
  const createAndAssignToProposal = useCreateAndAssignMaterialToProposalItem(categoryId, projectId);
  const removeMaterial = useRemoveMaterialFromItem(roomId);
  const removeFromProposal = useRemoveMaterialFromProposalItem(categoryId);
  const updateForItem = useUpdateMaterialForItem(roomId, projectId);
  const updateForProposalItem = useUpdateMaterialForProposalItem(categoryId, projectId);
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState({
    name: '',
    materialId: '',
    description: '',
    swatchFile: null as File | null,
    swatchHex: '#D9D4C8',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAssigned, setEditingAssigned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(null);
  const [addedMaterialName, setAddedMaterialName] = useState<string | null>(null);
  const [removedMaterialName, setRemovedMaterialName] = useState<string | null>(null);

  const assignedIds = useMemo(
    () => new Set(activeItem?.materials.map((m) => m.id) ?? []),
    [activeItem?.materials],
  );
  const priorityIds = useMemo(() => new Set(priorityMaterialIds), [priorityMaterialIds]);
  const editingMaterial = materials.data?.find((m) => m.id === editingId);

  const assignedMaterials = useMemo(
    () => [...(activeItem?.materials ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [activeItem?.materials],
  );
  const visibleMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...(materials.data ?? [])]
      .filter((m) => !assignedIds.has(m.id) && m.id !== pendingAssignmentId)
      .filter((m) => materialMatchesQuery(m, query))
      .sort((a, b) => {
        const prioritySort = Number(priorityIds.has(b.id)) - Number(priorityIds.has(a.id));
        if (prioritySort !== 0) return prioritySort;
        return a.name.localeCompare(b.name);
      });
  }, [assignedIds, materials.data, pendingAssignmentId, priorityIds, searchQuery]);

  const resetDraft = () => {
    setDraft({ name: '', materialId: '', description: '', swatchFile: null, swatchHex: '#D9D4C8' });
    setEditingId(null);
    setEditingAssigned(false);
  };

  const startEdit = (material: Material, isAssigned = false) => {
    setEditingId(material.id);
    setEditingAssigned(isAssigned);
    setDraft({
      name: material.name,
      materialId: material.materialId,
      description: material.description,
      swatchFile: null,
      swatchHex: material.swatchHex || '#D9D4C8',
    });
  };

  const saveDraft = async () => {
    const input = {
      name: draft.name.trim(),
      materialId: draft.materialId.trim(),
      description: draft.description.trim(),
      ...(draft.swatchHex ? { swatchHex: draft.swatchHex } : {}),
    };
    if (!input.name) return;
    let savedMaterial: Material;

    if (editingId && editingAssigned && activeItem) {
      // Scoped update: fork-if-shared
      if (props.context === 'ffe') {
        savedMaterial = await updateForItem.mutateAsync({
          itemId: activeItem.id,
          materialId: editingId,
          patch: input,
        });
      } else {
        savedMaterial = await updateForProposalItem.mutateAsync({
          proposalItemId: activeItem.id,
          materialId: editingId,
          patch: input,
        });
      }
    } else if (editingId) {
      savedMaterial = await updateMaterial.mutateAsync({ id: editingId, patch: input });
    } else if (activeItem) {
      if (props.context === 'ffe') {
        savedMaterial = await createAndAssignMaterial.mutateAsync({ itemId: activeItem.id, input });
      } else {
        savedMaterial = await createAndAssignToProposal.mutateAsync({
          proposalItemId: activeItem.id,
          input,
        });
      }
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
    if (!activeItem || assignedIds.has(material.id) || pendingAssignmentId) return;
    setAddedMaterialName(null);
    setRemovedMaterialName(null);
    setPendingAssignmentId(material.id);
    try {
      let assigned: Material;
      if (props.context === 'ffe') {
        assigned = await assignMaterial.mutateAsync({
          itemId: activeItem.id,
          materialId: material.id,
        });
      } else {
        assigned = await assignToProposal.mutateAsync({
          proposalItemId: activeItem.id,
          materialId: material.id,
        });
      }
      setAddedMaterialName(assigned.name);
    } finally {
      setPendingAssignmentId(null);
    }
  };

  const removeAssignedMaterial = async (material: Material) => {
    if (!activeItem) return;
    if (props.context === 'ffe') {
      await removeMaterial.mutateAsync({ itemId: activeItem.id, materialId: material.id });
    } else {
      await removeFromProposal.mutateAsync({
        proposalItemId: activeItem.id,
        materialId: material.id,
      });
    }
    setAddedMaterialName(null);
    setRemovedMaterialName(material.name);
  };

  const submitLabel = editingId
    ? editingAssigned
      ? 'Save (this item only)'
      : 'Save changes'
    : activeItem
      ? 'Add and assign'
      : 'Add to library';

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <MaterialForm
        draft={draft}
        editing={Boolean(editingMaterial)}
        submitLabel={submitLabel}
        onDraftChange={setDraft}
        onCancel={editingId ? resetDraft : undefined}
        onSubmit={() => void saveDraft()}
      />

      <section className="flex min-h-[24rem] max-h-[34rem] min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid gap-3 border-b border-gray-100 px-4 py-3">
          <h3 className="min-w-0 text-sm font-semibold text-gray-950">Project library</h3>
          {activeItem && (
            <div className="grid min-w-0 gap-3 rounded-lg border border-gray-200 bg-surface-muted p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Assigned to item
              </span>
              {assignedMaterials.length ? (
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  {assignedMaterials.map((material) => (
                    <span
                      key={material.id}
                      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm"
                    >
                      <MaterialSwatchImage material={material} size="sm" />
                      <span className="min-w-0 truncate">{material.name}</span>
                      <button
                        type="button"
                        className="rounded px-1 py-0.5 font-semibold text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                        onClick={() => startEdit(material, true)}
                        aria-label={`Edit ${material.name}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded px-1 py-0.5 font-semibold text-danger-700 hover:bg-danger-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                        onClick={() => void removeAssignedMaterial(material)}
                        aria-label={`Remove ${material.name} from item`}
                      >
                        ×
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search library"
            className={`${inputClassName} min-w-0`}
            aria-label="Search project library"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
          {materials.isLoading ? (
            <p className="text-sm text-gray-500">Loading library...</p>
          ) : visibleMaterials.length ? (
            <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
              {visibleMaterials.map((material) => (
                <MaterialPickerCard
                  key={material.id}
                  material={material}
                  assigning={pendingAssignmentId === material.id}
                  assignable={Boolean(activeItem)}
                  onSelect={() => void assignExistingMaterial(material)}
                  onEdit={() => startEdit(material, false)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              {searchQuery.trim()
                ? 'No library items match the current search.'
                : activeItem
                  ? 'All library items are already assigned to this item.'
                  : 'Add the first item to build the project library.'}
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
  swatchHex: string;
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
        {editing ? 'Edit item' : 'Add to library'}
      </h3>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          Name
          <input
            value={draft.name}
            onChange={(e) => onDraftChange((c) => ({ ...c, name: e.target.value }))}
            className={inputClassName}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          ID
          <input
            value={draft.materialId}
            onChange={(e) => onDraftChange((c) => ({ ...c, materialId: e.target.value }))}
            className={inputClassName}
          />
        </label>
        <div className="grid gap-2 text-sm font-medium text-gray-700">
          <span>Swatch</span>
          <div className="grid gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="h-full w-full rounded-full"
                    style={{ backgroundColor: draft.swatchHex }}
                  />
                )}
              </span>
              <div className="min-w-0 grid gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-normal text-gray-600 shrink-0">Color</label>
                  <input
                    type="color"
                    value={draft.swatchHex || '#D9D4C8'}
                    onChange={(e) => onDraftChange((c) => ({ ...c, swatchHex: e.target.value }))}
                    className="h-7 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
                    aria-label="Swatch color"
                  />
                  <input
                    type="text"
                    value={draft.swatchHex || ''}
                    onChange={(e) => onDraftChange((c) => ({ ...c, swatchHex: e.target.value }))}
                    placeholder="#D9D4C8"
                    maxLength={7}
                    className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-normal text-gray-950 focus:border-brand-500 focus:outline-none"
                    aria-label="Swatch hex value"
                  />
                </div>
                <p className="text-xs font-normal text-gray-500">
                  {draft.swatchFile ? draft.swatchFile.name : 'Image overrides color if uploaded.'}
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) =>
                onDraftChange((c) => ({ ...c, swatchFile: e.target.files?.[0] ?? null }))
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700 focus:border-brand-500 focus:outline-none"
              aria-label="Swatch image"
            />
          </div>
        </div>
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          Description
          <textarea
            value={draft.description}
            onChange={(e) => onDraftChange((c) => ({ ...c, description: e.target.value }))}
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
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
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
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
          <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
            {assigning ? 'Adding...' : assignable ? 'Click to add' : 'Library item'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </Button>
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
  const hexPlaceholder = material.swatchHex ? (
    <span
      className="h-full w-full rounded-full"
      style={{ backgroundColor: material.swatchHex }}
      aria-hidden="true"
    />
  ) : (
    <span className="text-[10px] font-semibold text-gray-400">IMG</span>
  );
  return (
    <ImageFrame
      entityType="material"
      entityId={material.id}
      alt={`${material.name} swatch`}
      className={`${frameClassName} shrink-0 border-gray-200 shadow-none ${className}`}
      imageClassName="object-cover"
      placeholderClassName="bg-white"
      placeholderContent={hexPlaceholder}
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
