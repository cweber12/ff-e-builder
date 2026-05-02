import { useMemo, useState } from 'react';
import { exportMaterialsExcel, exportMaterialsPdf } from '../lib/exportUtils';
import { useCreateMaterial, useDeleteMaterial, useMaterials, useUpdateMaterial } from '../hooks';
import type { Material, Project } from '../types';
import { Button } from './primitives';
import { ImageFrame } from './ImageFrame';
import { MaterialForm, MaterialSwatches } from './MaterialLibraryModal';

type MaterialsViewProps = {
  project: Project;
};

type MaterialDraft = {
  name: string;
  materialId: string;
  description: string;
  swatches: string[];
};

const defaultSwatch = '#D9D4C8';
const emptyDraft: MaterialDraft = {
  name: '',
  materialId: '',
  description: '',
  swatches: [defaultSwatch],
};

export function MaterialsView({ project }: MaterialsViewProps) {
  const materials = useMaterials(project.id);
  const createMaterial = useCreateMaterial(project.id);
  const updateMaterial = useUpdateMaterial(project.id);
  const deleteMaterial = useDeleteMaterial(project.id);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<MaterialDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingMaterial = materials.data?.find((material) => material.id === editingId);
  const filteredMaterials = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(materials.data ?? [])]
      .filter((material) => materialMatchesQuery(material, normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materials.data, query]);

  const resetDraft = () => {
    setDraft(emptyDraft);
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
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Materials</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage the reusable material library for {project.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
            <button
              type="button"
              className={viewMode === 'grid' ? activeToggleClassName : toggleClassName}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={viewMode === 'table' ? activeToggleClassName : toggleClassName}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => exportMaterialsExcel(project, filteredMaterials)}
            disabled={filteredMaterials.length === 0}
          >
            Export Excel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => exportMaterialsPdf(project, filteredMaterials)}
            disabled={filteredMaterials.length === 0}
          >
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <MaterialForm
          draft={draft}
          editing={Boolean(editingMaterial)}
          submitLabel={editingId ? 'Save changes' : 'Add material'}
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

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-950">Project materials</h3>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search materials"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950 focus:border-brand-500 focus:outline-none sm:w-72"
              aria-label="Search materials"
            />
          </div>
          <div className="max-h-[42rem] overflow-auto p-4">
            {materials.isLoading ? (
              <p className="text-sm text-gray-500">Loading materials...</p>
            ) : filteredMaterials.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                No materials match the current search.
              </p>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
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
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <ImageFrame
        entityType="material"
        entityId={material.id}
        alt={material.name}
        className="h-36 w-full rounded-none border-0 shadow-none"
        imageClassName="object-cover"
        compact
      />
      <div className="grid gap-3 p-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-gray-950">{material.name}</h4>
          <p className="truncate text-xs text-gray-500">
            {material.materialId || 'No material ID'}
          </p>
        </div>
        <MaterialSwatches swatches={material.swatches} fallback={material.swatchHex} size="sm" />
        {material.description && (
          <p className="line-clamp-2 text-xs leading-5 text-gray-600">{material.description}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            Delete
          </Button>
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
    <table className="w-full min-w-[720px] border-collapse text-sm">
      <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_rgb(243_244_246)]">
        <tr>
          <th className="px-3 py-3 font-semibold">Material</th>
          <th className="px-3 py-3 font-semibold">ID</th>
          <th className="px-3 py-3 font-semibold">Swatches</th>
          <th className="px-3 py-3 font-semibold">Description</th>
          <th className="px-3 py-3 font-semibold" aria-label="Actions" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {materials.map((material) => (
          <tr key={material.id}>
            <td className="px-3 py-3 font-medium text-gray-950">{material.name}</td>
            <td className="px-3 py-3 text-gray-600">{material.materialId || '-'}</td>
            <td className="px-3 py-3">
              <MaterialSwatches
                swatches={material.swatches}
                fallback={material.swatchHex}
                size="sm"
              />
            </td>
            <td className="max-w-sm px-3 py-3 text-gray-600">{material.description || '-'}</td>
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

const toggleClassName =
  'rounded px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';
const activeToggleClassName =
  'rounded bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

function normalizeSwatches(swatches: string[]) {
  const valid = swatches.filter((swatch) => /^#[0-9A-Fa-f]{6}$/.test(swatch));
  return (valid.length ? valid : [defaultSwatch])
    .filter((swatch, index, array) => array.indexOf(swatch) === index)
    .slice(0, 12);
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
