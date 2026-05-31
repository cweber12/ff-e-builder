import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  exportFinishesExcel,
  exportFinishesPdf,
  exportMaterialsExcel,
  exportMaterialsPdf,
} from '../../lib/export';
import {
  useCreateFinish,
  useCreateMaterial,
  useActionsMenu,
  useDeleteFinish,
  useDeleteImage,
  useDeleteMaterial,
  useFinishes,
  useMaterials,
  useImages,
  useUpdateFinish,
  useUpdateMaterial,
  useUploadImage,
  detectFinishCollision,
} from '../../hooks';
import type {
  Finish,
  ImageAsset,
  Material,
  MaterialCategory,
  MaterialType,
  Project,
} from '../../types';
import { imageKeys } from '../../lib/query';
import {
  Button,
  DropdownMenu,
  MenuItem,
  MenuPanel,
  MenuSeparator,
  Modal,
  SegmentedControl,
} from '../primitives';
import { ImageFrame } from '../shared/image/ImageFrame';
import { MaterialForm, ProductLinkIcon } from './MaterialLibraryModal';
import { FinishForm } from './FinishForm';
import { FinishCollisionPrompt } from './FinishCollisionPrompt';
import { ImportFinishesExcelModal } from './ImportFinishesExcelModal';
import { ImportMaterialsExcelModal } from './ImportMaterialsExcelModal';

type MaterialsViewProps = {
  project: Project;
  tool?: 'ffe' | 'proposal';
};

export type FinishDraft = {
  name: string;
  code: string;
  category: MaterialCategory | '';
  subCategory: string;
  description: string;
  manufacturer: string;
  sourceUrl: string;
  swatchMode: 'color' | 'image';
  swatchFile: File | null;
  swatchHex: string;
};

export type MaterialDraft = {
  name: string;
  code: string;
  finishId: string | null;
  materialType: MaterialType | '';
  materialId: string;
  description: string;
};

const emptyFinishDraft: FinishDraft = {
  name: '',
  code: '',
  category: '',
  subCategory: '',
  description: '',
  manufacturer: '',
  sourceUrl: '',
  swatchMode: 'color',
  swatchFile: null,
  swatchHex: '#D9D4C8',
};

const emptyMaterialDraft: MaterialDraft = {
  name: '',
  code: '',
  finishId: null,
  materialType: '',
  materialId: '',
  description: '',
};

type CategoryFilter = 'all' | MaterialCategory | 'uncategorized';
type LibraryTab = 'finishes' | 'materials';
type DeleteAllSelection = { tab: LibraryTab; ids: string[] } | null;

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  wood: 'Wood',
  metal: 'Metal',
  stone: 'Stone',
  glass: 'Glass',
  fabric: 'Fabric',
  solid_color: 'Solid Color',
};

const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
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
  const finishes = useFinishes(project.id);
  const materials = useMaterials(project.id);
  const createFinish = useCreateFinish(project.id);
  const updateFinish = useUpdateFinish(project.id);
  const deleteFinish = useDeleteFinish(project.id);
  const createMaterial = useCreateMaterial(project.id);
  const updateMaterial = useUpdateMaterial(project.id);
  const deleteMaterial = useDeleteMaterial(project.id);
  const uploadImage = useUploadImage();

  const [activeTab, setActiveTab] = useState<LibraryTab>('finishes');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [finishDraft, setFinishDraft] = useState<FinishDraft>(emptyFinishDraft);
  const [editingFinishId, setEditingFinishId] = useState<string | null>(null);
  const [showFinishForm, setShowFinishForm] = useState(false);

  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(emptyMaterialDraft);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [collisionPrompt, setCollisionPrompt] = useState<{
    existingFinish: Finish;
    draftName: string;
    swatchMode: 'color' | 'image';
    swatchFile: File | null;
  } | null>(null);
  const [showImportFinishesModal, setShowImportFinishesModal] = useState(false);
  const [showImportMaterialsModal, setShowImportMaterialsModal] = useState(false);
  const [deleteAllSelection, setDeleteAllSelection] = useState<DeleteAllSelection>(null);
  const [isDeleteAllPending, setIsDeleteAllPending] = useState(false);

  const editingFinishImages = useImages('finish', editingFinishId ?? '');
  const deleteFinishImage = useDeleteImage('finish', editingFinishId ?? '');

  const editingFinish = finishes.data?.find((f) => f.id === editingFinishId);
  const editingMaterial = materials.data?.find((m) => m.id === editingMaterialId);

  const filteredFinishes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(finishes.data ?? [])]
      .filter((finish) => {
        if (categoryFilter === 'uncategorized') return finish.category === null;
        if (categoryFilter !== 'all') return finish.category === categoryFilter;
        return true;
      })
      .filter((finish) => finishMatchesQuery(finish, normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [finishes.data, query, categoryFilter]);

  const filteredMaterials = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(materials.data ?? [])]
      .filter((material) => materialMatchesQuery(material, normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materials.data, query]);

  const resetFinishDraft = () => {
    setFinishDraft(emptyFinishDraft);
    setEditingFinishId(null);
    setShowFinishForm(false);
  };

  const resetMaterialDraft = () => {
    setMaterialDraft(emptyMaterialDraft);
    setEditingMaterialId(null);
    setShowMaterialForm(false);
  };

  const startEditFinish = (finish: Finish) => {
    const cachedImages = queryClient.getQueryData<ImageAsset[]>(
      imageKeys.forEntity('finish', finish.id),
    );
    setEditingFinishId(finish.id);
    setFinishDraft({
      name: finish.name,
      code: finish.code,
      category: finish.category ?? '',
      subCategory: finish.subCategory,
      description: finish.description,
      manufacturer: finish.manufacturer,
      sourceUrl: finish.sourceUrl,
      swatchMode: (cachedImages?.length ?? 0) > 0 ? 'image' : 'color',
      swatchFile: null,
      swatchHex: finish.swatchHex || '#D9D4C8',
    });
    setShowFinishForm(true);
  };

  const startEditMaterial = (material: Material) => {
    setEditingMaterialId(material.id);
    setMaterialDraft({
      name: material.name,
      code: material.code,
      finishId: material.finishId,
      materialType: material.materialType ?? '',
      materialId: material.materialId,
      description: material.description,
    });
    setShowMaterialForm(true);
  };

  const openCreateFinishForm = () => {
    setEditingFinishId(null);
    setFinishDraft(emptyFinishDraft);
    setShowFinishForm(true);
  };

  const openCreateMaterialForm = () => {
    setEditingMaterialId(null);
    setMaterialDraft(emptyMaterialDraft);
    setShowMaterialForm(true);
  };

  const saveFinishDraft = async () => {
    const input = {
      name: finishDraft.name.trim(),
      code: finishDraft.code.trim(),
      category: finishDraft.category || null,
      subCategory: finishDraft.subCategory.trim(),
      description: finishDraft.description.trim(),
      swatchHex: finishDraft.swatchHex || '#D9D4C8',
      manufacturer: finishDraft.manufacturer.trim(),
      sourceUrl: finishDraft.sourceUrl.trim(),
    };
    if (!input.name) return;

    if (!editingFinishId) {
      const collision = detectFinishCollision(input.name, finishes.data ?? []);
      if (collision) {
        setCollisionPrompt({
          existingFinish: collision,
          draftName: input.name,
          swatchMode: finishDraft.swatchMode,
          swatchFile: finishDraft.swatchFile,
        });
        return;
      }
    }

    let savedFinish: Finish;
    if (editingFinishId) {
      savedFinish = await updateFinish.mutateAsync({ id: editingFinishId, patch: input });
    } else {
      savedFinish = await createFinish.mutateAsync(input);
    }

    if (finishDraft.swatchMode === 'image' && finishDraft.swatchFile) {
      await uploadImage.mutateAsync({
        entityType: 'finish',
        entityId: savedFinish.id,
        file: finishDraft.swatchFile,
        altText: savedFinish.name,
      });
    } else if (finishDraft.swatchMode === 'color' && editingFinishId) {
      for (const img of editingFinishImages.data ?? []) {
        await deleteFinishImage.mutateAsync(img.id);
      }
    }

    resetFinishDraft();
  };

  const saveMaterialDraft = async () => {
    const input = {
      name: materialDraft.name.trim(),
      code: materialDraft.code.trim(),
      finishId: materialDraft.finishId || null,
      materialType: (materialDraft.materialType as MaterialType) || null,
      materialId: materialDraft.materialId.trim(),
      description: materialDraft.description.trim(),
    };
    if (!input.name) return;

    if (editingMaterialId) {
      await updateMaterial.mutateAsync({ id: editingMaterialId, patch: input });
    } else {
      await createMaterial.mutateAsync(input);
    }

    resetMaterialDraft();
  };

  const handleCollisionDecision = async (decision: 'use-existing' | 'overwrite') => {
    if (!collisionPrompt) return;
    const { existingFinish, swatchMode, swatchFile } = collisionPrompt;
    setCollisionPrompt(null);
    if (decision === 'overwrite' && swatchMode === 'image' && swatchFile) {
      await uploadImage.mutateAsync({
        entityType: 'finish',
        entityId: existingFinish.id,
        file: swatchFile,
        altText: existingFinish.name,
      });
    }
    resetFinishDraft();
  };

  const showForm = activeTab === 'finishes' ? showFinishForm : showMaterialForm;
  const deleteAllCount = deleteAllSelection?.ids.length ?? 0;
  const deleteAllTab = deleteAllSelection?.tab ?? 'finishes';
  const deleteAllLabel = deleteAllTab === 'finishes' ? 'finishes' : 'project materials';

  const openDeleteAllModal = (tab: LibraryTab) => {
    const ids =
      tab === 'finishes'
        ? filteredFinishes.map((finish) => finish.id)
        : filteredMaterials.map((material) => material.id);
    setDeleteAllSelection({ tab, ids });
  };

  const handleExport = (tab: LibraryTab, format: 'csv' | 'xlsx' | 'pdf') => {
    if (tab === 'finishes') {
      if (format === 'csv') {
        exportFinishesExcel(project, filteredFinishes, 'csv');
        return;
      }
      if (format === 'xlsx') {
        exportFinishesExcel(project, filteredFinishes);
        return;
      }
      exportFinishesPdf(project, filteredFinishes);
      return;
    }

    if (format === 'csv') {
      exportMaterialsExcel(project, filteredMaterials, 'csv');
      return;
    }
    if (format === 'xlsx') {
      exportMaterialsExcel(project, filteredMaterials);
      return;
    }
    exportMaterialsPdf(project, filteredMaterials);
  };

  const deleteAllSelected = async () => {
    if (!deleteAllSelection || deleteAllSelection.ids.length === 0 || isDeleteAllPending) return;

    const ids = [...deleteAllSelection.ids];
    const targetTab = deleteAllSelection.tab;
    setIsDeleteAllPending(true);
    let hadFailure = false;
    try {
      if (targetTab === 'finishes') {
        for (const id of ids) {
          try {
            await deleteFinish.mutateAsync(id);
          } catch {
            hadFailure = true;
          }
        }
        await finishes.refetch();
      } else {
        for (const id of ids) {
          try {
            await deleteMaterial.mutateAsync(id);
          } catch {
            hadFailure = true;
          }
        }
        await materials.refetch();
      }

      if (!hadFailure) setDeleteAllSelection(null);
    } finally {
      setIsDeleteAllPending(false);
    }
  };

  return (
    <div className="grid gap-6">
      <MaterialsToolbarLeft
        activeTab={activeTab}
        viewMode={viewMode}
        activeCount={activeTab === 'finishes' ? filteredFinishes.length : filteredMaterials.length}
        onImportFromExcel={(tab) => {
          if (tab === 'finishes') {
            setShowImportFinishesModal(true);
            return;
          }
          setShowImportMaterialsModal(true);
        }}
        onExport={handleExport}
        onDeleteAll={openDeleteAllModal}
        onActiveTabChange={setActiveTab}
        onViewModeChange={setViewMode}
      />
      <MaterialsToolbarActions
        activeTab={activeTab}
        query={query}
        showForm={showForm}
        categoryFilter={categoryFilter}
        onQueryChange={setQuery}
        onCreateFinish={openCreateFinishForm}
        onCreateMaterial={openCreateMaterialForm}
        onCategoryFilterChange={setCategoryFilter}
      />

      {activeTab === 'finishes' ? (
        <section>
          <div className="max-h-[48rem] overflow-auto py-2">
            {finishes.isLoading ? (
              <p className="text-sm text-neutral-500">Loading finishes…</p>
            ) : filteredFinishes.length === 0 ? (
              <p className="border-y border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
                No finishes match the current search.
              </p>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {filteredFinishes.map((finish) => (
                  <FinishGridCard
                    key={finish.id}
                    finish={finish}
                    onEdit={() => startEditFinish(finish)}
                    onDelete={() => void deleteFinish.mutateAsync(finish.id)}
                  />
                ))}
              </div>
            ) : (
              <FinishesTable
                finishes={filteredFinishes}
                onEdit={startEditFinish}
                onDelete={(finish) => void deleteFinish.mutateAsync(finish.id)}
              />
            )}
          </div>
        </section>
      ) : (
        <section>
          <div className="max-h-[48rem] overflow-auto py-2">
            {materials.isLoading ? (
              <p className="text-sm text-neutral-500">Loading materials…</p>
            ) : filteredMaterials.length === 0 ? (
              <p className="border-y border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
                No materials match the current search.
              </p>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {filteredMaterials.map((material) => (
                  <MaterialGridCard
                    key={material.id}
                    material={material}
                    finish={finishes.data?.find((f) => f.id === material.finishId)}
                    onEdit={() => startEditMaterial(material)}
                    onDelete={() => void deleteMaterial.mutateAsync(material.id)}
                  />
                ))}
              </div>
            ) : (
              <MaterialsTable
                materials={filteredMaterials}
                finishes={finishes.data ?? []}
                onEdit={startEditMaterial}
                onDelete={(material) => void deleteMaterial.mutateAsync(material.id)}
              />
            )}
          </div>
        </section>
      )}

      <Modal
        open={showFinishForm}
        onClose={resetFinishDraft}
        title={editingFinishId ? 'Edit finish' : 'Add finish'}
        className="!max-w-[min(96vw,42rem)]"
      >
        <div className="-mx-6 -my-5">
          <FinishForm
            draft={finishDraft}
            editing={Boolean(editingFinish)}
            editingFinishId={editingFinishId ?? undefined}
            submitLabel={editingFinishId ? 'Save changes' : 'Add to library'}
            onDraftChange={setFinishDraft}
            onCancel={resetFinishDraft}
            onSubmit={() => void saveFinishDraft()}
          />
        </div>
      </Modal>

      <Modal
        open={showMaterialForm}
        onClose={resetMaterialDraft}
        title={editingMaterialId ? 'Edit material' : 'Add material'}
        className="!max-w-[min(96vw,42rem)]"
      >
        <div className="-mx-6 -my-5">
          <MaterialForm
            draft={materialDraft}
            editing={Boolean(editingMaterial)}
            finishes={finishes.data ?? []}
            submitLabel={editingMaterialId ? 'Save changes' : 'Add material'}
            onDraftChange={setMaterialDraft}
            onCancel={resetMaterialDraft}
            onSubmit={() => void saveMaterialDraft()}
          />
        </div>
      </Modal>
      <Modal
        open={Boolean(deleteAllSelection)}
        onClose={() => {
          if (isDeleteAllPending) return;
          setDeleteAllSelection(null);
        }}
        title={deleteAllTab === 'finishes' ? 'Delete all finishes' : 'Delete all project materials'}
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            {`This will permanently delete ${deleteAllCount} ${deleteAllLabel}.`}
          </p>
          {deleteAllTab === 'finishes' && (
            <p className="text-sm text-danger-700">
              Deleting finishes will not delete project materials, and finish relationships may need
              relinking.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteAllSelection(null)}
              disabled={isDeleteAllPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void deleteAllSelected()}
              disabled={deleteAllCount === 0 || isDeleteAllPending}
            >
              {isDeleteAllPending
                ? `Deleting ${deleteAllCount} ${deleteAllLabel}…`
                : `Delete ${deleteAllCount} ${deleteAllLabel}`}
            </Button>
          </div>
        </div>
      </Modal>

      <ImportFinishesExcelModal
        open={showImportFinishesModal}
        projectId={project.id}
        finishes={finishes.data ?? []}
        onClose={() => setShowImportFinishesModal(false)}
        onSuccess={() => {
          void finishes.refetch();
        }}
      />
      <ImportMaterialsExcelModal
        open={showImportMaterialsModal}
        projectId={project.id}
        finishes={finishes.data ?? []}
        onClose={() => setShowImportMaterialsModal(false)}
        onSuccess={() => {
          void materials.refetch();
        }}
      />
      {collisionPrompt && (
        <FinishCollisionPrompt
          existingFinish={collisionPrompt.existingFinish}
          draftName={collisionPrompt.draftName}
          onUseExisting={() => void handleCollisionDecision('use-existing')}
          onOverwrite={() => void handleCollisionDecision('overwrite')}
          onCancel={() => setCollisionPrompt(null)}
        />
      )}
    </div>
  );
}

function MaterialsToolbarLeft({
  activeTab,
  viewMode,
  activeCount,
  onImportFromExcel,
  onExport,
  onDeleteAll,
  onActiveTabChange,
  onViewModeChange,
}: {
  activeTab: LibraryTab;
  viewMode: 'grid' | 'table';
  activeCount: number;
  onImportFromExcel: (tab: LibraryTab) => void;
  onExport: (tab: LibraryTab, format: 'csv' | 'xlsx' | 'pdf') => void;
  onDeleteAll: (tab: LibraryTab) => void;
  onActiveTabChange: (value: LibraryTab) => void;
  onViewModeChange: (value: 'grid' | 'table') => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const exportMenu = useActionsMenu();
  const [optionsTriggerElement, setOptionsTriggerElement] = useState<HTMLButtonElement | null>(
    null,
  );

  useEffect(() => {
    const el = document.getElementById(MATERIALS_FILTER_SLOT_ID);
    setSlot(el);
  }, []);

  if (!slot) return null;

  const exportMenuPosition = exportMenu.getPortalPosition(exportMenu.triggerRef, {
    align: 'bottom',
    edge: 'left',
    offsetY: 4,
  });

  return createPortal(
    <>
      <div className="flex w-full items-center gap-2">
        <DropdownMenu
          wrapperClassName="relative inline-flex"
          panelClassName="z-[120] min-w-52"
          positionOptions={{ align: 'bottom', edge: 'left', offsetY: 4 }}
          renderTrigger={({ triggerRef, open, toggleMenu }) => (
            <Button
              ref={triggerRef}
              type="button"
              variant="toolbar"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Options"
              title="Options"
              className="project-sidebar-control !w-auto justify-center px-2"
              onClick={(event) => {
                setOptionsTriggerElement(event.currentTarget);
                if (exportMenu.open) exportMenu.closeMenu();
                toggleMenu();
              }}
            >
              <SlidersHorizontal className="toolbar-icon" aria-hidden="true" />
            </Button>
          )}
        >
          {({ closeMenu }) => (
            <>
              <div className="px-2.5 py-2">
                <p className="toolbar-label pb-1">View</p>
                <SegmentedControl
                  value={viewMode}
                  onChange={onViewModeChange}
                  ariaLabel="Materials view mode"
                  variant="toolbar"
                  className="w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-start"
                >
                  <SegmentedControl.Option value="grid">Grid</SegmentedControl.Option>
                  <SegmentedControl.Option value="table">Table</SegmentedControl.Option>
                </SegmentedControl>
              </div>
              <MenuSeparator />
              <MenuItem
                className="px-3 py-2"
                onClick={() => {
                  closeMenu();
                  onImportFromExcel(activeTab);
                }}
              >
                Import from Excel
              </MenuItem>
              <MenuItem
                className={
                  activeCount === 0
                    ? 'cursor-not-allowed px-3 py-2 text-neutral-400 hover:bg-white hover:text-neutral-400'
                    : 'px-3 py-2'
                }
                disabled={activeCount === 0}
                aria-haspopup="menu"
                onClick={() => {
                  closeMenu();
                  if (activeCount === 0 || !optionsTriggerElement) return;
                  exportMenu.triggerRef.current = optionsTriggerElement;
                  exportMenu.openMenu();
                }}
              >
                Export
              </MenuItem>
              <MenuItem
                disabled={activeCount === 0}
                className={
                  activeCount === 0
                    ? 'cursor-not-allowed px-3 py-2 text-neutral-400 hover:bg-white hover:text-neutral-400'
                    : 'px-3 py-2 text-danger-600 hover:bg-danger-50 hover:text-danger-700'
                }
                onClick={() => {
                  closeMenu();
                  onDeleteAll(activeTab);
                }}
              >
                Delete All
              </MenuItem>
            </>
          )}
        </DropdownMenu>
        <span className="toolbar-stat ml-auto">
          <span className="num text-neutral-950">{activeCount}</span>
          <span className="text-neutral-500">{activeCount === 1 ? 'item' : 'items'}</span>
        </span>
      </div>
      <SegmentedControl
        value={activeTab}
        onChange={onActiveTabChange}
        ariaLabel="Library section"
        variant="toolbar"
        className="w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-start"
      >
        <SegmentedControl.Option value="finishes">Finishes</SegmentedControl.Option>
        <SegmentedControl.Option value="materials">Materials</SegmentedControl.Option>
      </SegmentedControl>
      {exportMenu.open &&
        exportMenuPosition &&
        createPortal(
          <MenuPanel
            ref={exportMenu.panelRef}
            position={exportMenuPosition}
            className="z-[121] min-w-36"
          >
            <MenuItem
              className={
                activeCount === 0
                  ? 'cursor-not-allowed px-3 py-2 text-neutral-400 hover:bg-white hover:text-neutral-400'
                  : 'px-3 py-2'
              }
              disabled={activeCount === 0}
              onClick={() => {
                if (activeCount === 0) return;
                exportMenu.closeMenu();
                onExport(activeTab, 'csv');
              }}
            >
              Export CSV
            </MenuItem>
            <MenuItem
              className={
                activeCount === 0
                  ? 'cursor-not-allowed px-3 py-2 text-neutral-400 hover:bg-white hover:text-neutral-400'
                  : 'px-3 py-2'
              }
              disabled={activeCount === 0}
              onClick={() => {
                if (activeCount === 0) return;
                exportMenu.closeMenu();
                onExport(activeTab, 'xlsx');
              }}
            >
              Export Excel
            </MenuItem>
            <MenuItem
              className={
                activeCount === 0
                  ? 'cursor-not-allowed px-3 py-2 text-neutral-400 hover:bg-white hover:text-neutral-400'
                  : 'px-3 py-2'
              }
              disabled={activeCount === 0}
              onClick={() => {
                if (activeCount === 0) return;
                exportMenu.closeMenu();
                onExport(activeTab, 'pdf');
              }}
            >
              Export PDF
            </MenuItem>
          </MenuPanel>,
          document.body,
        )}
    </>,
    slot,
  );
}

function MaterialsToolbarActions({
  activeTab,
  query,
  showForm,
  categoryFilter,
  onQueryChange,
  onCreateFinish,
  onCreateMaterial,
  onCategoryFilterChange,
}: {
  activeTab: LibraryTab;
  query: string;
  showForm: boolean;
  categoryFilter: CategoryFilter;
  onQueryChange: (value: string) => void;
  onCreateFinish: () => void;
  onCreateMaterial: () => void;
  onCategoryFilterChange: (value: CategoryFilter) => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(MATERIALS_ACTIONS_SLOT_ID);
    setSlot(el);
  }, []);

  if (!slot) return null;

  return createPortal(
    <div className="project-sidebar-slot">
      {!showForm && (
        <Button
          type="button"
          variant="addAction"
          onClick={activeTab === 'finishes' ? onCreateFinish : onCreateMaterial}
          className="w-full justify-start"
        >
          <Plus className="toolbar-icon" aria-hidden="true" />
          {activeTab === 'finishes' ? 'New finish' : 'New material'}
        </Button>
      )}
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={activeTab === 'finishes' ? 'Search finishes' : 'Search materials'}
        className="toolbar-input w-full"
        aria-label={activeTab === 'finishes' ? 'Search finishes' : 'Search project materials'}
      />
      {activeTab === 'finishes' && (
        <select
          value={categoryFilter}
          onChange={(event) => onCategoryFilterChange(event.target.value as CategoryFilter)}
          className="toolbar-select w-full"
          aria-label="Filter by category"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>,
    slot,
  );
}

function FinishGridCard({
  finish,
  onEdit,
  onDelete,
}: {
  finish: Finish;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="tile-card flex flex-col">
      <ImageFrame
        entityType="finish"
        entityId={finish.id}
        alt={finish.name}
        className="h-24 w-full rounded-none border-0 shadow-none"
        imageClassName="object-cover"
        compact
      />
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="min-w-0">
          <p className="num truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
            {finish.code || 'No code'}
          </p>
          <h4 className="mt-0.5 truncate text-sm font-semibold leading-tight text-neutral-950">
            {finish.name}
          </h4>
          {finish.category && (
            <p className="mt-0.5 truncate text-[10px] text-neutral-500">
              {CATEGORY_LABELS[finish.category]}
              {finish.subCategory ? ` · ${finish.subCategory}` : ''}
            </p>
          )}
        </div>
        {finish.description && (
          <p className="line-clamp-2 text-xs leading-snug text-neutral-600">{finish.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <ProductLinkIcon url={finish.sourceUrl} label={finish.name} />
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

function MaterialGridCard({
  material,
  finish,
  onEdit,
  onDelete,
}: {
  material: Material;
  finish?: Finish | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="tile-card flex flex-col">
      {finish ? (
        <ImageFrame
          entityType="finish"
          entityId={finish.id}
          alt={finish.name}
          className="h-24 w-full rounded-none border-0 shadow-none"
          imageClassName="object-cover"
          compact
        />
      ) : (
        <div className="h-24 w-full bg-canvas-shell" />
      )}
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="min-w-0">
          <p className="num truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
            {material.code || 'No code'}
          </p>
          <h4 className="mt-0.5 truncate text-sm font-semibold leading-tight text-neutral-950">
            {material.name}
          </h4>
          {(finish || material.materialType) && (
            <p className="mt-0.5 truncate text-[10px] text-neutral-500">
              {[
                finish?.name,
                material.materialType ? MATERIAL_TYPE_LABELS[material.materialType] : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        {material.description && (
          <p className="line-clamp-2 text-xs leading-snug text-neutral-600">
            {material.description}
          </p>
        )}
        <div className="mt-auto flex justify-end gap-1 pt-1">
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

function FinishesTable({
  finishes,
  onEdit,
  onDelete,
}: {
  finishes: Finish[];
  onEdit: (finish: Finish) => void;
  onDelete: (finish: Finish) => void;
}) {
  return (
    <table className="w-full min-w-[900px] border-collapse text-sm">
      <thead className="sticky top-0 border-b border-neutral-200 bg-canvas-chrome text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
        <tr>
          <th className="px-3 py-3">Swatch</th>
          <th className="px-3 py-3">Name</th>
          <th className="px-3 py-3">Code</th>
          <th className="px-3 py-3">Category</th>
          <th className="px-3 py-3">Manufacturer</th>
          <th className="px-3 py-3">Description</th>
          <th className="px-3 py-3" aria-label="Actions" />
        </tr>
      </thead>
      <tbody className="divide-y divide-black/10">
        {finishes.map((finish) => (
          <tr key={finish.id}>
            <td className="px-3 py-3">
              <div className="flex items-center gap-2">
                <ImageFrame
                  entityType="finish"
                  entityId={finish.id}
                  alt={`${finish.name} swatch`}
                  className="h-12 w-12 rounded-full border-neutral-200 shadow-none"
                  imageClassName="object-cover"
                  placeholderClassName="bg-canvas-shell"
                  placeholderContent={
                    <span className="text-[10px] font-semibold text-neutral-400">IMG</span>
                  }
                  compact
                  disabled
                />
                <ProductLinkIcon url={finish.sourceUrl} label={finish.name} />
              </div>
            </td>
            <td className="px-3 py-3 font-medium text-neutral-950">{finish.name}</td>
            <td className="num px-3 py-3 text-neutral-700">{finish.code || '—'}</td>
            <td className="px-3 py-3 text-neutral-700">
              {finish.category ? (
                <span>
                  {CATEGORY_LABELS[finish.category]}
                  {finish.subCategory ? (
                    <span className="ml-1 text-neutral-500">· {finish.subCategory}</span>
                  ) : null}
                </span>
              ) : (
                '—'
              )}
            </td>
            <td className="px-3 py-3 text-neutral-700">{finish.manufacturer || '—'}</td>
            <td className="max-w-sm px-3 py-3 text-neutral-600">{finish.description || '—'}</td>
            <td className="px-3 py-3">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(finish)}>
                  Edit
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(finish)}>
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

function MaterialsTable({
  materials,
  finishes,
  onEdit,
  onDelete,
}: {
  materials: Material[];
  finishes: Finish[];
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
}) {
  const finishById = useMemo(() => new Map(finishes.map((f) => [f.id, f])), [finishes]);

  return (
    <table className="w-full min-w-[900px] border-collapse text-sm">
      <thead className="sticky top-0 border-b border-neutral-200 bg-canvas-chrome text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
        <tr>
          <th className="px-3 py-3">Swatch</th>
          <th className="px-3 py-3">Name</th>
          <th className="px-3 py-3">Code</th>
          <th className="px-3 py-3">Finish</th>
          <th className="px-3 py-3">Type</th>
          <th className="px-3 py-3">Mfr. ID</th>
          <th className="px-3 py-3">Description</th>
          <th className="px-3 py-3" aria-label="Actions" />
        </tr>
      </thead>
      <tbody className="divide-y divide-black/10">
        {materials.map((material) => {
          const finish = material.finishId ? finishById.get(material.finishId) : undefined;
          return (
            <tr key={material.id}>
              <td className="px-3 py-3">
                {finish ? (
                  <ImageFrame
                    entityType="finish"
                    entityId={finish.id}
                    alt={`${material.name} swatch`}
                    className="h-12 w-12 rounded-full border-neutral-200 shadow-none"
                    imageClassName="object-cover"
                    placeholderClassName="bg-canvas-shell"
                    compact
                    disabled
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-canvas-shell" />
                )}
              </td>
              <td className="px-3 py-3 font-medium text-neutral-950">{material.name}</td>
              <td className="num px-3 py-3 text-neutral-700">{material.code || '—'}</td>
              <td className="px-3 py-3 text-neutral-700">{finish?.name ?? '—'}</td>
              <td className="px-3 py-3 text-neutral-700">
                {material.materialType ? MATERIAL_TYPE_LABELS[material.materialType] : '—'}
              </td>
              <td className="num px-3 py-3 text-neutral-700">{material.materialId || '—'}</td>
              <td className="max-w-sm px-3 py-3 text-neutral-600">{material.description || '—'}</td>
              <td className="px-3 py-3">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(material)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(material)}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function finishMatchesQuery(finish: Finish, query: string) {
  if (!query) return true;
  return [finish.name, finish.code, finish.description, finish.manufacturer]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function materialMatchesQuery(material: Material, query: string) {
  if (!query) return true;
  return [material.name, material.code, material.materialId, material.description]
    .join(' ')
    .toLowerCase()
    .includes(query);
}
