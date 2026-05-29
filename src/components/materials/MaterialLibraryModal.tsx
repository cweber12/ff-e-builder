import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent,
} from 'react';
import {
  useCreateMaterial,
  useFinishes,
  useItemMaterialActions,
  useMaterials,
  useUpdateMaterial,
} from '../../hooks';
import type { Finish, Item, Material, MaterialType, ProposalItem } from '../../types';
import { Button, Modal } from '../primitives';
import { ImageFrame } from '../shared/image/ImageFrame';

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
  /**
   * Ordered list of recently-assigned material IDs (most recent first). Shown
   * as a quick-apply strip between the assigned-materials strip and the full
   * project library.
   */
  recentMaterialIds?: string[] | undefined;
  onClose: () => void;
  onMaterialAssigned?: (materialId: string) => void;
} & (FfeContext | ProposalContext);

export function MaterialLibraryModal(props: MaterialLibraryModalProps) {
  const { open, onClose, onMaterialAssigned, ...panelProps } = props;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Project Materials"
      className="!max-w-[min(96vw,96rem)] !w-[min(96vw,96rem)]"
    >
      <MaterialLibraryPanel
        {...panelProps}
        {...(onMaterialAssigned !== undefined ? { onMaterialAssigned } : {})}
      />
    </Modal>
  );
}

type MaterialLibraryPanelProps =
  | ({
      projectId: string;
      priorityMaterialIds?: string[] | undefined;
      recentMaterialIds?: string[] | undefined;
      onMaterialAssigned?: (materialId: string) => void;
    } & FfeContext)
  | ({
      projectId: string;
      priorityMaterialIds?: string[] | undefined;
      recentMaterialIds?: string[] | undefined;
      onMaterialAssigned?: (materialId: string) => void;
    } & ProposalContext);

export type MaterialDraft = {
  name: string;
  code: string;
  finishId: string | null;
  materialType: MaterialType | '';
  materialId: string;
  description: string;
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  veneer: 'Veneer',
  laminate: 'Laminate',
  solid: 'Solid',
  powder_coat: 'Powder Coat',
  anodized: 'Anodized',
  upholstery: 'Upholstery',
  stone_slab: 'Stone Slab',
  glass: 'Glass',
  painted: 'Painted',
  stained: 'Stained',
};

const MATERIAL_TYPES: MaterialType[] = [
  'veneer',
  'laminate',
  'solid',
  'powder_coat',
  'anodized',
  'upholstery',
  'stone_slab',
  'glass',
  'painted',
  'stained',
];

const emptyDraft: MaterialDraft = {
  name: '',
  code: '',
  finishId: null,
  materialType: '',
  materialId: '',
  description: '',
};

export function MaterialLibraryPanel(props: MaterialLibraryPanelProps) {
  const { projectId, priorityMaterialIds = [], recentMaterialIds = [], onMaterialAssigned } = props;
  const roomId = props.context === 'ffe' ? props.roomId : '';
  const categoryId = props.context === 'proposal' ? props.categoryId : '';
  const activeItem: Item | ProposalItem | undefined = props.item;

  const finishes = useFinishes(projectId);
  const materials = useMaterials(projectId);
  const createMaterial = useCreateMaterial(projectId);
  const updateMaterial = useUpdateMaterial(projectId);
  const materialActions = useItemMaterialActions(
    props.context === 'ffe'
      ? { kind: 'ffe', itemGroupId: roomId, projectId }
      : { kind: 'proposal', itemGroupId: categoryId, projectId },
  );

  const [draft, setDraft] = useState<MaterialDraft>(emptyDraft);
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
  const recentUnassignedMaterials = useMemo(() => {
    const library = materials.data ?? [];
    const byId = new Map(library.map((m) => [m.id, m]));
    return recentMaterialIds
      .map((id) => byId.get(id))
      .filter((m): m is Material => Boolean(m))
      .filter((m) => !assignedIds.has(m.id));
  }, [assignedIds, materials.data, recentMaterialIds]);
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
    setDraft(emptyDraft);
    setEditingId(null);
    setEditingAssigned(false);
    setShowForm(false);
  };

  const startEdit = (material: Material, isAssigned = false) => {
    setEditingId(material.id);
    setEditingAssigned(isAssigned);
    setDraft({
      name: material.name,
      code: material.code,
      finishId: material.finishId,
      materialType: material.materialType ?? '',
      materialId: material.materialId,
      description: material.description,
    });
    setShowForm(true);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setEditingAssigned(false);
    setDraft(emptyDraft);
    setShowForm(true);
  };

  const saveDraft = async () => {
    const input = {
      name: draft.name.trim(),
      code: draft.code.trim(),
      finishId: draft.finishId || null,
      materialType: (draft.materialType as MaterialType) || null,
      materialId: draft.materialId.trim(),
      description: draft.description.trim(),
    };
    if (!input.name) return;
    let savedMaterial: Material;

    if (editingId && editingAssigned && activeItem) {
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
      onMaterialAssigned?.(savedMaterial.id);
    } else {
      savedMaterial = await createMaterial.mutateAsync(input);
    }

    resetDraft();
    return savedMaterial;
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
      onMaterialAssigned?.(assigned.id);
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

      {activeItem && recentUnassignedMaterials.length > 0 && (
        <RecentMaterialsStrip
          materials={recentUnassignedMaterials}
          finishes={finishes.data ?? []}
          assigning={pendingAssignmentId}
          onApply={(m) => void assignExistingMaterial(m)}
        />
      )}

      <div
        className={`grid min-w-0 gap-5 ${
          showForm
            ? editingId
              ? 'lg:grid-cols-[22rem_minmax(0,16rem)_minmax(0,1fr)]'
              : 'lg:grid-cols-[22rem_minmax(0,1fr)]'
            : ''
        }`}
      >
        {showForm && (
          <MaterialForm
            draft={draft}
            editing={Boolean(editingMaterial)}
            editingMaterialId={editingId ?? undefined}
            finishes={finishes.data ?? []}
            submitLabel={submitLabel}
            onDraftChange={setDraft}
            onCancel={resetDraft}
            onSubmit={() => void saveDraft()}
          />
        )}

        {showForm && editingId && (
          <FinishLibraryPanel
            finishes={finishes.data ?? []}
            onFinishSelect={(finish) =>
              setDraft((c) => ({
                ...c,
                finishId: finish.id === c.finishId ? c.finishId : finish.id,
                name: c.name || finish.name,
              }))
            }
          />
        )}

        <section className="flex min-h-[28rem] max-h-[72vh] min-w-0 flex-col overflow-hidden border-y border-neutral-200 bg-canvas-chrome">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
            <div className="flex items-baseline gap-3">
              <h3 className="eyebrow">Project materials</h3>
              <span className="num text-[11px] font-semibold text-neutral-500">
                {visibleMaterials.length} {visibleMaterials.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or code…"
                className="input-base sm:w-64"
                aria-label="Search project materials"
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
                    finish={finishes.data?.find((f) => f.id === material.finishId)}
                    assigning={pendingAssignmentId === material.id}
                    assignable={Boolean(activeItem)}
                    onSelect={() => void assignExistingMaterial(material)}
                    onEdit={() => startEdit(material, false)}
                  />
                ))}
              </div>
            ) : (
              <p className="border-y border-dashed border-neutral-200 bg-canvas-chrome px-4 py-10 text-center text-sm text-neutral-500">
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

function RecentMaterialsStrip({
  materials,
  finishes,
  assigning,
  onApply,
}: {
  materials: Material[];
  finishes: Finish[];
  assigning: string | null;
  onApply: (material: Material) => void;
}) {
  const finishById = useMemo(() => new Map(finishes.map((f) => [f.id, f])), [finishes]);
  return (
    <section
      aria-label="Recently used materials"
      className="border-y border-neutral-200 bg-canvas-chrome px-5 py-3"
    >
      <div className="flex items-center gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Recent
        </h3>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {materials.map((material) => (
            <button
              key={material.id}
              type="button"
              onClick={() => onApply(material)}
              disabled={assigning === material.id}
              aria-label={`Apply ${material.name}`}
              title={`Apply ${material.name}`}
              className="inline-flex max-w-[14rem] items-center gap-2 rounded-full border border-neutral-200 bg-surface px-2 py-1 text-xs font-medium text-neutral-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-progress disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <MaterialSwatchImage
                material={material}
                finish={material.finishId ? finishById.get(material.finishId) : undefined}
                size="sm"
              />
              <span className="truncate">{material.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinishLibraryPanel({
  finishes,
  onFinishSelect,
}: {
  finishes: Finish[];
  onFinishSelect: (finish: Finish) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return finishes;
    return finishes.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q) ||
        f.manufacturer.toLowerCase().includes(q),
    );
  }, [finishes, search]);

  return (
    <section
      aria-label="Finish library"
      className="flex min-h-[28rem] max-h-[72vh] min-w-0 flex-col overflow-hidden border-y border-neutral-200 bg-canvas-chrome"
    >
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
        <h3 className="eyebrow flex-1">Finishes</h3>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="input-base text-xs"
          aria-label="Search finish library"
        />
      </div>
      <p className="border-b border-dashed border-neutral-200 px-4 py-2 text-[11px] text-neutral-400">
        Drag or click a finish to preview
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {finishes.length === 0 ? (
          <p className="text-xs text-neutral-400">No finishes in library yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-neutral-400">No finishes match.</p>
        ) : (
          <div className="grid gap-1.5">
            {filtered.map((finish) => (
              <DraggableFinishItem key={finish.id} finish={finish} onSelect={onFinishSelect} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DraggableFinishItem({
  finish,
  onSelect,
}: {
  finish: Finish;
  onSelect: (finish: Finish) => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', finish.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onSelect(finish)}
      aria-label={`Assign ${finish.name}`}
      className="flex w-full cursor-grab items-center gap-2 rounded-sm border border-neutral-200 bg-surface px-2 py-1.5 text-left text-sm font-medium text-neutral-700 transition hover:border-brand-400 hover:bg-brand-50 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <ImageFrame
        entityType="finish"
        entityId={finish.id}
        alt={finish.name}
        className="h-7 w-7 shrink-0 rounded-full border-0 shadow-none"
        imageClassName="object-cover"
        compact
        disabled
      />
      <span className="min-w-0 flex-1 truncate">{finish.name}</span>
      {finish.code && (
        <span className="num shrink-0 text-[10px] text-neutral-500">{finish.code}</span>
      )}
    </button>
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
    <span className="group inline-flex max-w-xs items-center gap-2 border border-neutral-200 bg-canvas-chrome py-1 pl-1 pr-1 shadow-sm transition hover:border-brand-400">
      <MaterialSwatchImage material={material} size="sm" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold text-neutral-950">{material.name}</span>
        {material.code && (
          <span className="num truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
            {material.code}
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

export function MaterialForm({
  draft,
  editing,
  finishes,
  submitLabel,
  onDraftChange,
  onCancel,
  onSubmit,
}: {
  draft: MaterialDraft;
  editing: boolean;
  editingMaterialId?: string | undefined;
  finishes: Finish[];
  submitLabel: string;
  onDraftChange: (updater: (current: MaterialDraft) => MaterialDraft) => void;
  onCancel?: (() => void) | undefined;
  onSubmit: () => void;
}) {
  const [finishSearch, setFinishSearch] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedFinish = finishes.find((f) => f.id === draft.finishId);

  const filteredFinishes = useMemo(() => {
    const q = finishSearch.trim().toLowerCase();
    if (!q) return finishes;
    return finishes.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q) ||
        f.manufacturer.toLowerCase().includes(q),
    );
  }, [finishes, finishSearch]);

  const selectFinish = (finish: Finish | null) => {
    onDraftChange((c) => ({
      ...c,
      finishId: finish?.id ?? null,
      name: c.name || finish?.name || '',
    }));
    setFinishSearch('');
  };

  return (
    <section className="border-y border-neutral-200 bg-canvas-shell p-5">
      <p className="eyebrow">{editing ? 'Edit Material' : 'Add Material'}</p>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-1 text-sm font-medium text-neutral-700">
          <span>Finish</span>
          <div
            aria-label="Finish drop zone"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const finishId = e.dataTransfer.getData('text/plain');
              if (!finishId || finishId === draft.finishId) return;
              const finish = finishes.find((f) => f.id === finishId);
              if (finish) selectFinish(finish);
            }}
            className={`rounded-sm transition-shadow ${isDragOver ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`}
          >
            {selectedFinish ? (
              <div className="flex items-center gap-2 rounded-sm border border-neutral-200 bg-canvas-chrome px-3 py-2">
                <ImageFrame
                  entityType="finish"
                  entityId={selectedFinish.id}
                  alt={selectedFinish.name}
                  className="h-8 w-8 shrink-0 rounded-full border-0 shadow-none"
                  imageClassName="object-cover"
                  compact
                  disabled
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-neutral-950">
                    {selectedFinish.name}
                  </span>
                  {selectedFinish.code && (
                    <span className="num text-[10px] text-neutral-500">{selectedFinish.code}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => selectFinish(null)}
                  className="shrink-0 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 hover:text-danger-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="grid gap-1">
                <input
                  value={finishSearch}
                  onChange={(e) => setFinishSearch(e.target.value)}
                  placeholder="Search finishes…"
                  className={inputClassName}
                />
                {(finishSearch.trim() || draft.finishId === null) && finishes.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-sm border border-neutral-200 bg-canvas-chrome">
                    {filteredFinishes.length ? (
                      filteredFinishes.slice(0, 20).map((finish) => (
                        <button
                          key={finish.id}
                          type="button"
                          onClick={() => selectFinish(finish)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                        >
                          <ImageFrame
                            entityType="finish"
                            entityId={finish.id}
                            alt={finish.name}
                            className="h-7 w-7 shrink-0 rounded-full border-0 shadow-none"
                            imageClassName="object-cover"
                            compact
                            disabled
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-neutral-950">
                            {finish.name}
                          </span>
                          {finish.code && (
                            <span className="num shrink-0 text-[10px] text-neutral-500">
                              {finish.code}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-neutral-500">No finishes match.</p>
                    )}
                  </div>
                )}
                {finishes.length === 0 && (
                  <p className="text-xs text-neutral-400">
                    No finishes in library yet — add some in the Finish Library tab.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="grid gap-1 text-sm font-medium text-neutral-700">
            <label htmlFor="material-type">Type</label>
            <select
              id="material-type"
              value={draft.materialType}
              onChange={(e) =>
                onDraftChange((c) => ({ ...c, materialType: e.target.value as MaterialType | '' }))
              }
              className={inputClassName}
            >
              <option value="">— Unspecified —</option>
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MATERIAL_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <label className="grid gap-1 text-sm font-medium text-neutral-700">
            Code
            <input
              value={draft.code}
              onChange={(e) => onDraftChange((c) => ({ ...c, code: e.target.value }))}
              placeholder="Auto-assigned if blank"
              className={inputClassName}
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Name
          <input
            value={draft.name}
            onChange={(e) => onDraftChange((c) => ({ ...c, name: e.target.value }))}
            placeholder={selectedFinish?.name ?? ''}
            className={inputClassName}
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Manufacturer Ref
          <input
            value={draft.materialId}
            onChange={(e) => onDraftChange((c) => ({ ...c, materialId: e.target.value }))}
            placeholder="Optional manufacturer / supplier ID"
            className={inputClassName}
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Description
          <textarea
            value={draft.description}
            onChange={(e) => onDraftChange((c) => ({ ...c, description: e.target.value }))}
            rows={3}
            className={inputClassName}
          />
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="button" onClick={onSubmit} disabled={!draft.name.trim() && !selectedFinish}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

function MaterialPickerCard({
  material,
  finish,
  assigning,
  assignable,
  onSelect,
  onEdit,
}: {
  material: Material;
  finish?: Finish | undefined;
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
        {finish ? (
          <ImageFrame
            entityType="finish"
            entityId={finish.id}
            alt={finish.name}
            className="h-24 w-full rounded-none border-0 shadow-none"
            imageClassName="object-cover"
            compact
            disabled
          />
        ) : (
          <div className="h-24 w-full bg-canvas-shell" />
        )}
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
          {material.code || 'No code'}
        </p>
        <h4 className="truncate text-sm font-semibold leading-tight text-neutral-950">
          {material.name}
        </h4>
        {(finish || material.materialType) && (
          <p className="truncate text-[10px] text-neutral-500">
            {[
              finish?.name,
              material.materialType ? MATERIAL_TYPE_LABELS[material.materialType] : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <div className="mt-auto flex items-center justify-end pt-1">
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

const MATERIAL_BADGE_LIMIT = 4;

export function MaterialBadges({
  materials,
  onOpen,
  onPasteImage,
  isPasting = false,
  getFinishName,
}: {
  materials: Material[];
  onOpen: () => void;
  onPasteImage?: ((file: File) => Promise<void> | void) | undefined;
  isPasting?: boolean | undefined;
  getFinishName?: ((material: Material) => string | undefined) | undefined;
}) {
  const assigned = materials.slice(0, MATERIAL_BADGE_LIMIT);
  const overflow = materials.length - assigned.length;
  const documentPasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);

  const handlePaste = (event: ClipboardEvent | ReactClipboardEvent) => {
    if (!onPasteImage || isPasting) return;
    const pastedImage = Array.from(event.clipboardData?.items ?? [])
      .find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'))
      ?.getAsFile();
    if (!pastedImage) return;
    event.preventDefault();
    void onPasteImage(pastedImage);
  };

  const enablePasteTarget = () => {
    if (!onPasteImage || isPasting || documentPasteHandlerRef.current) return;
    const handler = (event: ClipboardEvent) => handlePaste(event);
    documentPasteHandlerRef.current = handler;
    document.addEventListener('paste', handler);
  };

  const disablePasteTarget = () => {
    const handler = documentPasteHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('paste', handler);
    documentPasteHandlerRef.current = null;
  };

  useEffect(
    () => () => {
      const handler = documentPasteHandlerRef.current;
      if (handler) document.removeEventListener('paste', handler);
    },
    [],
  );

  if (assigned.length === 0) {
    return (
      <button
        type="button"
        onPaste={handlePaste}
        onMouseEnter={enablePasteTarget}
        onMouseLeave={disablePasteTarget}
        onFocus={enablePasteTarget}
        onBlur={disablePasteTarget}
        onClick={onOpen}
        className="group inline-flex items-center gap-1 text-left text-xs text-neutral-400 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label="Edit item materials"
        title={onPasteImage ? 'Paste swatch image (Ctrl+V)' : undefined}
      >
        <PencilEditIcon className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        {isPasting ? 'Pasting swatch…' : 'Add materials'}
      </button>
    );
  }

  return (
    <div
      tabIndex={onPasteImage ? 0 : undefined}
      onPaste={handlePaste}
      onMouseEnter={enablePasteTarget}
      onMouseLeave={disablePasteTarget}
      onFocus={enablePasteTarget}
      onBlur={disablePasteTarget}
      className="group relative inline-block max-w-[13rem] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      title={onPasteImage ? 'Paste swatch image (Ctrl+V)' : undefined}
    >
      <div className="grid grid-cols-1 gap-y-1.5">
        {assigned.map((material) => {
          const finishName = getFinishName?.(material)?.trim() ?? '';
          return (
            <div key={material.id} className="flex flex-col items-center gap-0.5">
              <MaterialSwatchImage material={material} size="sm" />
              <div className="w-full text-center leading-tight">
                <span
                  title={material.name}
                  className="block w-full whitespace-normal break-words text-[10px] text-neutral-700"
                >
                  {material.name}
                </span>
                {finishName && (
                  <span
                    title={finishName}
                    className="block w-full whitespace-normal break-words text-[10px] text-neutral-500"
                  >
                    {finishName}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {overflow > 0 && (
        <span className="mt-0.5 block text-[10px] font-medium text-neutral-500">
          +{overflow} more
        </span>
      )}
      {isPasting && (
        <span className="mt-0.5 block text-[10px] font-medium text-brand-700">Pasting swatch…</span>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label="Edit materials"
        title="Edit materials"
        className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-surface text-neutral-500 opacity-0 shadow-sm transition-opacity hover:bg-brand-50 hover:text-brand-700 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 group-hover:opacity-100"
      >
        <PencilEditIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function PencilEditIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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
      title="No product link — add one in the finish edit form"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-300"
    >
      <ChainLinkGlyph />
    </span>
  );
}

export function MaterialSwatchImage({
  material,
  finish,
  size = 'md',
  className = '',
}: {
  material: Material;
  finish?: Finish | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string | undefined;
}) {
  const frameClassName =
    size === 'sm'
      ? 'h-9 w-9 rounded-full'
      : size === 'lg'
        ? 'h-20 w-20 rounded-full'
        : 'h-10 w-10 rounded-full';

  const finishId = finish?.id ?? material.finishId ?? '';

  if (!finishId) {
    return (
      <span
        className={`${frameClassName} shrink-0 bg-canvas-shell ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <ImageFrame
      entityType="finish"
      entityId={finishId}
      alt={`${material.name} swatch`}
      className={`${frameClassName} shrink-0 border-0 shadow-none ${className}`}
      imageClassName="object-cover"
      placeholderClassName="bg-canvas-shell"
      compact
      disabled
    />
  );
}

function materialMatchesQuery(material: Material, query: string) {
  if (!query) return true;
  return [material.name, material.code, material.materialId, material.description]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

const inputClassName = 'input-base';
