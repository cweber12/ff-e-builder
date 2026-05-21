import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  useCreateMaterial,
  useItemMaterialActions,
  useMaterials,
  useUpdateMaterial,
  useUploadImage,
} from '../../hooks';
import type { Item, Material, ProposalItem } from '../../types';
import { Button, Modal } from '../primitives';
import { ImageFrame } from '../shared/image/ImageFrame';
import { describeCatalogEntry, lookupCatalogEntry } from '../../lib/materials/catalog';

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
    <Modal
      open={open}
      onClose={onClose}
      title="Finish Library"
      className="!max-w-[min(96vw,96rem)] !w-[min(96vw,96rem)]"
    >
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
  const materialActions = useItemMaterialActions(
    props.context === 'ffe'
      ? { kind: 'ffe', itemGroupId: roomId, projectId }
      : { kind: 'proposal', itemGroupId: categoryId, projectId },
  );
  const uploadImage = useUploadImage();

  const [draft, setDraft] = useState({
    name: '',
    materialId: '',
    description: '',
    swatchFile: null as File | null,
    swatchHex: '#D9D4C8',
    manufacturer: '',
    sourceUrl: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAssigned, setEditingAssigned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(null);
  const [addedMaterialName, setAddedMaterialName] = useState<string | null>(null);
  const [removedMaterialName, setRemovedMaterialName] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
    setDraft({
      name: '',
      materialId: '',
      description: '',
      swatchFile: null,
      swatchHex: '#D9D4C8',
      manufacturer: '',
      sourceUrl: '',
    });
    setEditingId(null);
    setEditingAssigned(false);
    setShowForm(false);
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
      manufacturer: material.manufacturer,
      sourceUrl: material.sourceUrl,
    });
    setShowForm(true);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setEditingAssigned(false);
    setDraft({
      name: '',
      materialId: '',
      description: '',
      swatchFile: null,
      swatchHex: '#D9D4C8',
      manufacturer: '',
      sourceUrl: '',
    });
    setShowForm(true);
  };

  const saveDraft = async () => {
    const input = {
      name: draft.name.trim(),
      materialId: draft.materialId.trim(),
      description: draft.description.trim(),
      ...(draft.swatchHex ? { swatchHex: draft.swatchHex } : {}),
      ...(draft.manufacturer.trim() ? { manufacturer: draft.manufacturer.trim() } : {}),
      ...(draft.sourceUrl.trim() ? { sourceUrl: draft.sourceUrl.trim() } : {}),
    };
    if (!input.name) return;
    let savedMaterial: Material;

    if (editingId && editingAssigned && activeItem) {
      // Scoped update: fork-if-shared
      savedMaterial = await materialActions.update.mutateAsync({
        itemId: activeItem.id,
        materialId: editingId,
        patch: input,
      });
    } else if (editingId) {
      savedMaterial = await updateMaterial.mutateAsync({ id: editingId, patch: input });
    } else if (activeItem) {
      savedMaterial = await materialActions.createAndAssign.mutateAsync({
        itemId: activeItem.id,
        input,
      });
      setAddedMaterialName(savedMaterial.name);
      setRemovedMaterialName(null);
    } else {
      savedMaterial = await createMaterial.mutateAsync(input);
    }

    if (draft.swatchFile) {
      await uploadImage.mutateAsync({
        entityType: 'material',
        entityId: savedMaterial.id,
        file: draft.swatchFile,
        altText: savedMaterial.name,
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
      const assigned = await materialActions.assign.mutateAsync({
        itemId: activeItem.id,
        materialId: material.id,
      });
      setAddedMaterialName(assigned.name);
    } finally {
      setPendingAssignmentId(null);
    }
  };

  const removeAssignedMaterial = async (material: Material) => {
    if (!activeItem) return;
    await materialActions.remove.mutateAsync({ itemId: activeItem.id, materialId: material.id });
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
    <div className="grid min-w-0 gap-5">
      {activeItem && (
        <AssignedMaterialsStrip
          materials={assignedMaterials}
          addedName={addedMaterialName}
          removedName={removedMaterialName}
          onEdit={(m) => startEdit(m, true)}
          onRemove={(m) => void removeAssignedMaterial(m)}
        />
      )}

      <div className={`grid min-w-0 gap-5 ${showForm ? 'lg:grid-cols-[22rem_minmax(0,1fr)]' : ''}`}>
        {showForm && (
          <MaterialForm
            draft={draft}
            editing={Boolean(editingMaterial)}
            submitLabel={submitLabel}
            onDraftChange={setDraft}
            onCancel={resetDraft}
            onSubmit={() => void saveDraft()}
          />
        )}

        <section className="flex min-h-[28rem] max-h-[72vh] min-w-0 flex-col overflow-hidden border-y border-black/10 bg-canvas-chrome">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-5 py-4">
            <div className="flex items-baseline gap-3">
              <h3 className="eyebrow">Project library</h3>
              <span className="num text-[11px] font-semibold text-neutral-500">
                {visibleMaterials.length} {visibleMaterials.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or ID…"
                className="input-base sm:w-80"
                aria-label="Search project library"
              />
              {!showForm && (
                <Button type="button" size="sm" onClick={openCreateForm}>
                  + New material
                </Button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-canvas-shell p-5">
            {materials.isLoading ? (
              <p className="text-sm text-neutral-500">Loading library...</p>
            ) : visibleMaterials.length ? (
              <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-4">
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
              <p className="border-y border-dashed border-black/15 bg-canvas-chrome px-4 py-10 text-center text-sm text-neutral-500">
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
    </div>
  );
}

function AssignedMaterialsStrip({
  materials,
  addedName,
  removedName,
  onEdit,
  onRemove,
}: {
  materials: Material[];
  addedName: string | null;
  removedName: string | null;
  onEdit: (material: Material) => void;
  onRemove: (material: Material) => void;
}) {
  return (
    <section className="border-y border-brand-700/30 bg-brand-50/60 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
            Assigned to this item
          </h3>
          <span className="num text-[11px] font-semibold text-brand-700/80">
            {materials.length} {materials.length === 1 ? 'material' : 'materials'}
          </span>
        </div>
        {(addedName || removedName) && (
          <p
            role="status"
            className={`text-xs font-medium ${removedName ? 'text-danger-700' : 'text-brand-700'}`}
          >
            {removedName ? `Removed ${removedName}` : `Added ${addedName}`}
          </p>
        )}
      </div>
      {materials.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {materials.map((material) => (
            <AssignedMaterialChip
              key={material.id}
              material={material}
              onEdit={() => onEdit(material)}
              onRemove={() => onRemove(material)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-brand-800/70">
          No materials assigned yet — pick from the library below to add some.
        </p>
      )}
    </section>
  );
}

function AssignedMaterialChip({
  material,
  onEdit,
  onRemove,
}: {
  material: Material;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="group inline-flex max-w-xs items-center gap-2 border border-black/10 bg-canvas-chrome py-1 pl-1 pr-1 shadow-sm transition hover:border-brand-400">
      <MaterialSwatchImage material={material} size="sm" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold text-neutral-950">{material.name}</span>
        {material.materialId && (
          <span className="num truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
            {material.materialId}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="ml-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label={`Edit ${material.name}`}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-sm p-1 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label={`Remove ${material.name} from item`}
        title="Remove from item"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
    </span>
  );
}

type MaterialDraft = {
  name: string;
  materialId: string;
  description: string;
  swatchFile: File | null;
  swatchHex: string;
  manufacturer: string;
  sourceUrl: string;
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
  const [lookupHint, setLookupHint] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.swatchFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(draft.swatchFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.swatchFile]);

  const runLookup = () => {
    const entry = lookupCatalogEntry(draft.sourceUrl || draft.materialId);
    if (!entry) {
      setLookupHint('No catalog match found — fill the fields manually.');
      return;
    }
    onDraftChange((c) => ({
      ...c,
      name: c.name.trim() || entry.name,
      materialId: c.materialId.trim() || entry.materialId,
      manufacturer: c.manufacturer.trim() || entry.manufacturer,
      sourceUrl: entry.sourceUrl,
      description: c.description.trim() || describeCatalogEntry(entry),
    }));
    setLookupHint(`Matched ${entry.manufacturer} ${entry.urlCode} — ${entry.name}.`);
  };

  return (
    <section className="border-y border-black/10 bg-canvas-shell p-5">
      <p className="eyebrow">{editing ? 'Edit Item' : 'Add To Library'}</p>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-1 text-sm font-medium text-neutral-700">
          <label htmlFor="material-source-url">Product URL or ID</label>
          <div className="flex gap-2">
            <input
              id="material-source-url"
              type="text"
              value={draft.sourceUrl}
              onChange={(e) => {
                setLookupHint(null);
                onDraftChange((c) => ({ ...c, sourceUrl: e.target.value }));
              }}
              placeholder="https://www.formica.com/.../07197  or  7197"
              className={inputClassName}
            />
            <Button type="button" variant="ghost" size="sm" onClick={runLookup}>
              Look up
            </Button>
          </div>
          {lookupHint && <p className="text-xs font-normal text-neutral-500">{lookupHint}</p>}
        </div>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Name
          <input
            value={draft.name}
            onChange={(e) => onDraftChange((c) => ({ ...c, name: e.target.value }))}
            className={inputClassName}
          />
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <label className="grid gap-1 text-sm font-medium text-neutral-700">
            ID
            <input
              value={draft.materialId}
              onChange={(e) => onDraftChange((c) => ({ ...c, materialId: e.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-neutral-700">
            Manufacturer
            <input
              value={draft.manufacturer}
              onChange={(e) => onDraftChange((c) => ({ ...c, manufacturer: e.target.value }))}
              className={inputClassName}
            />
          </label>
        </div>
        <div className="grid gap-2 text-sm font-medium text-neutral-700">
          <span>Swatch</span>
          <div className="grid gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 overflow-hidden rounded-full border border-black/15 bg-canvas-chrome">
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
                  <label className="text-xs font-normal text-neutral-600 shrink-0">Color</label>
                  <input
                    type="color"
                    value={draft.swatchHex || '#D9D4C8'}
                    onChange={(e) => onDraftChange((c) => ({ ...c, swatchHex: e.target.value }))}
                    className="h-7 w-10 cursor-pointer rounded-sm border border-black/15 bg-canvas-chrome p-0.5"
                    aria-label="Swatch color"
                  />
                  <input
                    type="text"
                    value={draft.swatchHex || ''}
                    onChange={(e) => onDraftChange((c) => ({ ...c, swatchHex: e.target.value }))}
                    placeholder="#D9D4C8"
                    maxLength={7}
                    className="num w-24 rounded-sm border border-black/15 bg-canvas-chrome px-2 py-1 text-xs font-normal text-neutral-950 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                    aria-label="Swatch hex value"
                  />
                </div>
                <p className="text-xs font-normal text-neutral-500">
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
              className="input-base file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"
              aria-label="Swatch image"
            />
          </div>
        </div>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
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
      role={assignable ? 'button' : undefined}
      tabIndex={assignable ? 0 : -1}
      aria-label={assignable ? `Add ${material.name} to item` : material.name}
      aria-busy={assigning}
      onClick={assignable ? onSelect : undefined}
      onKeyDown={assignable ? handleKeyDown : undefined}
      className={`tile-card group relative flex min-w-0 flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${
        assignable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="relative">
        <ImageFrame
          entityType="material"
          entityId={material.id}
          alt={material.name}
          className="h-24 w-full rounded-none border-0 shadow-none"
          imageClassName="object-cover"
          compact
          placeholderContent={<span className="text-lg text-neutral-400">+</span>}
          disabled
        />
        {assignable && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-brand-900/0 opacity-0 transition group-hover:bg-brand-900/40 group-hover:opacity-100 group-focus-visible:bg-brand-900/40 group-focus-visible:opacity-100"
            aria-hidden="true"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-md">
              {assigning ? 'Adding…' : '+ Add to item'}
            </span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <p className="num truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
          {material.materialId || 'No ID'}
        </p>
        <h4 className="truncate text-sm font-semibold leading-tight text-neutral-950">
          {material.name}
        </h4>
        <div className="mt-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <MaterialSwatchImage material={material} size="sm" />
            <ProductLinkIcon url={material.sourceUrl} label={material.name} />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-label={`Edit ${material.name}`}
          >
            Edit
          </button>
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
            className="inline-flex max-w-full items-center gap-1 border border-black/10 bg-canvas-chrome px-2 py-0.5 text-xs font-medium text-neutral-800"
          >
            <MaterialSwatchImage material={material} size="sm" />
            <span className="truncate">{material.name}</span>
          </span>
        ))
      ) : (
        <span className="text-neutral-400">Add materials</span>
      )}
    </button>
  );
}

function ChainLinkGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path d="M10 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
      <path d="M14 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
    </svg>
  );
}

export function ProductLinkIcon({ url, label }: { url: string; label: string }) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label={`Open product page for ${label}`}
        title="Open product page"
      >
        <ChainLinkGlyph />
      </a>
    );
  }
  return (
    <span
      aria-hidden="true"
      title="No product link — add one in the material edit form"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-300"
    >
      <ChainLinkGlyph />
    </span>
  );
}

export function MaterialSwatchImage({
  material,
  size = 'md',
  className = '',
}: {
  material: Material;
  size?: 'sm' | 'md' | 'lg';
  className?: string | undefined;
}) {
  const frameClassName =
    size === 'sm'
      ? 'h-9 w-9 rounded-full'
      : size === 'lg'
        ? 'h-20 w-20 rounded-full'
        : 'h-10 w-10 rounded-full';
  const hexPlaceholder = material.swatchHex ? (
    <span
      className="h-full w-full rounded-full"
      style={{ backgroundColor: material.swatchHex }}
      aria-hidden="true"
    />
  ) : (
    <span className="text-[10px] font-semibold text-neutral-400">IMG</span>
  );
  return (
    <ImageFrame
      entityType="material"
      entityId={material.id}
      alt={`${material.name} swatch`}
      className={`${frameClassName} shrink-0 border-0 shadow-none ${className}`}
      imageClassName="object-cover"
      placeholderClassName="bg-canvas-shell"
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

// Shared input visual — see `.input-base` in src/index.css for the full ruleset.
const inputClassName = 'input-base';
