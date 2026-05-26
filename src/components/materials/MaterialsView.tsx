import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { exportMaterialsExcel, exportMaterialsPdf } from '../../lib/export';
import {
  useCreateMaterial,
  useDeleteImage,
  useDeleteMaterial,
  useMaterials,
  useImages,
  useUpdateMaterial,
  useUploadImage,
} from '../../hooks';
import type { ImageAsset, Material, MaterialCategory, Project } from '../../types';
import { imageKeys } from '../../lib/query';
import { Button } from '../primitives';
import { ImageFrame } from '../shared/image/ImageFrame';
import { ExportMenu } from '../shared/ExportMenu';
import { MaterialForm, ProductLinkIcon } from './MaterialLibraryModal';

type MaterialsViewProps = {
  project: Project;
  tool?: 'ffe' | 'proposal';
};

export type MaterialDraft = {
  name: string;
  materialId: string;
  category: MaterialCategory | '';
  subCategory: string;
  description: string;
  manufacturer: string;
  sourceUrl: string;
  swatchMode: 'color' | 'image';
  swatchFile: File | null;
  swatchHex: string;
};

const emptyDraft: MaterialDraft = {
  name: '',
  materialId: '',
  category: '',
  subCategory: '',
  description: '',
  manufacturer: '',
  sourceUrl: '',
  swatchMode: 'color',
  swatchFile: null,
  swatchHex: '#D9D4C8',
};

type CategoryFilter = 'all' | MaterialCategory | 'uncategorized';

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  wood: 'Wood',
  metal: 'Metal',
  stone: 'Stone',
  glass: 'Glass',
  fabric: 'Fabric',
  solid_color: 'Solid Color',
};

const FILTER_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'wood', label: 'Wood' },
  { value: 'metal', label: 'Metal' },
  { value: 'stone', label: 'Stone' },
  { value: 'glass', label: 'Glass' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'solid_color', label: 'Solid Color' },
  { value: 'uncategorized', label: 'Uncategorized' },
];

export const MATERIALS_ACTIONS_SLOT_ID = 'materials-actions-slot';
export const MATERIALS_FILTER_SLOT_ID = 'materials-filter-slot';

export function MaterialsView({ project, tool: _tool = 'ffe' }: MaterialsViewProps) {
  const queryClient = useQueryClient();
  const materials = useMaterials(project.id);
  const createMaterial = useCreateMaterial(project.id);
  const updateMaterial = useUpdateMaterial(project.id);
  const deleteMaterial = useDeleteMaterial(project.id);
  const uploadImage = useUploadImage();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [draft, setDraft] = useState<MaterialDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const editingMaterialImages = useImages('material', editingId ?? '');
  const deleteImage = useDeleteImage('material', editingId ?? '');

  const editingMaterial = materials.data?.find((material) => material.id === editingId);

  const filteredMaterials = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(materials.data ?? [])]
      .filter((material) => {
        if (categoryFilter === 'uncategorized') return material.category === null;
        if (categoryFilter !== 'all') return material.category === categoryFilter;
        return true;
      })
      .filter((material) => materialMatchesQuery(material, normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materials.data, query, categoryFilter]);

  const resetDraft = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (material: Material) => {
    const cachedImages = queryClient.getQueryData<ImageAsset[]>(
      imageKeys.forEntity('material', material.id),
    );
    setEditingId(material.id);
    setDraft({
      name: material.name,
      materialId: material.materialId,
      category: material.category ?? '',
      subCategory: material.subCategory,
      description: material.description,
      manufacturer: material.manufacturer,
      sourceUrl: material.sourceUrl,
      swatchMode: (cachedImages?.length ?? 0) > 0 ? 'image' : 'color',
      swatchFile: null,
      swatchHex: material.swatchHex || '#D9D4C8',
    });
    setShowForm(true);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setShowForm(true);
  };

  const saveDraft = async () => {
    const input = {
      name: draft.name.trim(),
      materialId: draft.materialId.trim(),
      category: draft.category || null,
      subCategory: draft.subCategory.trim(),
      description: draft.description.trim(),
      swatchHex: draft.swatchHex || '#D9D4C8',
      manufacturer: draft.manufacturer.trim(),
      sourceUrl: draft.sourceUrl.trim(),
    };
    if (!input.name) return;

    let savedMaterial: Material;
    if (editingId) {
      savedMaterial = await updateMaterial.mutateAsync({ id: editingId, patch: input });
    } else {
      savedMaterial = await createMaterial.mutateAsync(input);
    }

    if (draft.swatchMode === 'image' && draft.swatchFile) {
      await uploadImage.mutateAsync({
        entityType: 'material',
        entityId: savedMaterial.id,
        file: draft.swatchFile,
        altText: savedMaterial.name,
      });
    } else if (draft.swatchMode === 'color' && editingId) {
      for (const img of editingMaterialImages.data ?? []) {
        await deleteImage.mutateAsync(img.id);
      }
    }

    resetDraft();
  };

  return (
    <div className="grid gap-6">
      <MaterialsToolbarLeft
        viewMode={viewMode}
        categoryFilter={categoryFilter}
        onViewModeChange={setViewMode}
        onCategoryFilterChange={setCategoryFilter}
      />
      <MaterialsToolbarActions
        project={project}
        filteredMaterials={filteredMaterials}
        query={query}
        showForm={showForm}
        onQueryChange={setQuery}
        onCreateMaterial={openCreateForm}
      />

      <div className={`grid gap-6 ${showForm ? 'xl:grid-cols-[22rem_minmax(0,1fr)]' : ''}`}>
        {showForm && (
          <MaterialForm
            draft={draft}
            editing={Boolean(editingMaterial)}
            editingMaterialId={editingId ?? undefined}
            submitLabel={editingId ? 'Save changes' : 'Add to library'}
            onDraftChange={setDraft}
            onCancel={resetDraft}
            onSubmit={() => void saveDraft()}
          />
        )}

        <section>
          <div className="max-h-[48rem] overflow-auto py-2">
            {materials.isLoading ? (
              <p className="text-sm text-neutral-500">Loading materials…</p>
            ) : filteredMaterials.length === 0 ? (
              <p className="border-y border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
                No materials match the current search.
              </p>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
                {filteredMaterials.map((material) => (
                  <MaterialGridCard
                    key={material.id}
                    material={material}
                    onEdit={() => startEdit(material)}
                    onDelete={() => void deleteMaterial.mutateAsync(material.id)}
                  />
                ))}
              </div>
            ) : (
              <MaterialsTable
                materials={filteredMaterials}
                onEdit={startEdit}
                onDelete={(material) => void deleteMaterial.mutateAsync(material.id)}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MaterialsToolbarLeft({
  viewMode,
  categoryFilter,
  onViewModeChange,
  onCategoryFilterChange,
}: {
  viewMode: 'grid' | 'table';
  categoryFilter: CategoryFilter;
  onViewModeChange: (value: 'grid' | 'table') => void;
  onCategoryFilterChange: (value: CategoryFilter) => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(MATERIALS_FILTER_SLOT_ID);
    setSlot(el);
  }, []);

  if (!slot) return null;

  return createPortal(
    <>
      <div className="segmented" role="tablist" aria-label="Materials view mode">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'grid'}
          data-active={viewMode === 'grid' || undefined}
          onClick={() => onViewModeChange('grid')}
        >
          Grid
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'table'}
          data-active={viewMode === 'table' || undefined}
          onClick={() => onViewModeChange('table')}
        >
          Table
        </button>
      </div>
      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value as CategoryFilter)}
        className="input-compact h-8 min-w-[8.5rem] text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700"
        aria-label="Filter by category"
      >
        {FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </>,
    slot,
  );
}

function MaterialsToolbarActions({
  project,
  filteredMaterials,
  query,
  showForm,
  onQueryChange,
  onCreateMaterial,
}: {
  project: Project;
  filteredMaterials: Material[];
  query: string;
  showForm: boolean;
  onQueryChange: (value: string) => void;
  onCreateMaterial: () => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(MATERIALS_ACTIONS_SLOT_ID);
    setSlot(el);
  }, []);

  if (!slot) return null;

  return createPortal(
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-2 rounded-sm border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.10em] text-neutral-700">
        <span className="num text-neutral-950">{filteredMaterials.length}</span>
        <span className="text-neutral-500">
          {filteredMaterials.length === 1 ? 'item' : 'items'}
        </span>
      </span>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search name or ID"
        className="input-base h-8 w-64 py-1.5"
        aria-label="Search library by name or ID"
      />
      <ExportMenu
        label={
          <>
            <ExportIcon />
            <span className="btn-action__label">Export</span>
          </>
        }
        onCsv={() => void exportMaterialsExcel(project, filteredMaterials, 'csv')}
        onExcel={() => void exportMaterialsExcel(project, filteredMaterials)}
        onPdf={() => void exportMaterialsPdf(project, filteredMaterials)}
        disabled={filteredMaterials.length === 0}
        buttonClassName="btn-action"
      />
      {!showForm && (
        <Button type="button" variant="toolbarPrimary" onClick={onCreateMaterial}>
          + New material
        </Button>
      )}
    </div>,
    slot,
  );
}

function MaterialGridCard({
  material,
  onEdit,
  onDelete,
}: {
  material: Material;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="tile-card flex flex-col">
      <ImageFrame
        entityType="material"
        entityId={material.id}
        alt={material.name}
        className="h-24 w-full rounded-none border-0 shadow-none"
        imageClassName="object-cover"
        compact
      />
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="min-w-0">
          <p className="num truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
            {material.materialId || 'No ID'}
          </p>
          <h4 className="mt-0.5 truncate text-sm font-semibold leading-tight text-neutral-950">
            {material.name}
          </h4>
          {material.category && (
            <p className="mt-0.5 truncate text-[10px] text-neutral-500">
              {CATEGORY_LABELS[material.category]}
              {material.subCategory ? ` · ${material.subCategory}` : ''}
            </p>
          )}
        </div>
        {material.description && (
          <p className="line-clamp-2 text-xs leading-snug text-neutral-600">
            {material.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <ProductLinkIcon url={material.sourceUrl} label={material.name} />
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MaterialsTable({
  materials,
  onEdit,
  onDelete,
}: {
  materials: Material[];
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
}) {
  return (
    <table className="w-full min-w-[900px] border-collapse text-sm">
      <thead className="sticky top-0 border-b border-neutral-200 bg-canvas-chrome text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
        <tr>
          <th className="px-3 py-3">Swatch</th>
          <th className="px-3 py-3">Material</th>
          <th className="px-3 py-3">ID</th>
          <th className="px-3 py-3">Category</th>
          <th className="px-3 py-3">Manufacturer</th>
          <th className="px-3 py-3">Description</th>
          <th className="px-3 py-3" aria-label="Actions" />
        </tr>
      </thead>
      <tbody className="divide-y divide-black/10">
        {materials.map((material) => (
          <tr key={material.id}>
            <td className="px-3 py-3">
              <div className="flex items-center gap-2">
                <ImageFrame
                  entityType="material"
                  entityId={material.id}
                  alt={`${material.name} swatch`}
                  className="h-12 w-12 rounded-full border-neutral-200 shadow-none"
                  imageClassName="object-cover"
                  placeholderClassName="bg-canvas-shell"
                  placeholderContent={
                    <span className="text-[10px] font-semibold text-neutral-400">IMG</span>
                  }
                  compact
                  disabled
                />
                <ProductLinkIcon url={material.sourceUrl} label={material.name} />
              </div>
            </td>
            <td className="px-3 py-3 font-medium text-neutral-950">{material.name}</td>
            <td className="num px-3 py-3 text-neutral-700">{material.materialId || '—'}</td>
            <td className="px-3 py-3 text-neutral-700">
              {material.category ? (
                <span>
                  {CATEGORY_LABELS[material.category]}
                  {material.subCategory ? (
                    <span className="ml-1 text-neutral-500">· {material.subCategory}</span>
                  ) : null}
                </span>
              ) : (
                '—'
              )}
            </td>
            <td className="px-3 py-3 text-neutral-700">{material.manufacturer || '—'}</td>
            <td className="max-w-sm px-3 py-3 text-neutral-600">{material.description || '—'}</td>
            <td className="px-3 py-3">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(material)}>
                  Edit
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(material)}>
                  Delete
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function materialMatchesQuery(material: Material, query: string) {
  if (!query) return true;
  return [material.name, material.materialId, material.description, material.manufacturer]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function ExportIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-4 w-4"
      aria-label="Export"
    >
      <path d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z" />
      <path d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
    </svg>
  );
}
