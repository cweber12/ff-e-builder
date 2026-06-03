import { useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  exportFinishesExcel,
  exportFinishesPdf,
  exportMaterialsExcel,
  exportMaterialsPdf,
} from '../../lib/export';
import {
  detectFinishCollision,
  useCreateFinish,
  useCreateMaterial,
  useDeleteFinish,
  useDeleteImage,
  useDeleteMaterial,
  useFinishes,
  useImages,
  useMaterials,
  useUpdateFinish,
  useUpdateMaterial,
  useUploadImage,
} from '../../hooks';
import { imageKeys } from '../../lib/query';
import type {
  Finish,
  ImageAsset,
  Material,
  MaterialCategory,
  MaterialType,
  Project,
} from '../../types';
import {
  Button,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubTrigger,
  Modal,
  SegmentedControl,
} from '../primitives';
import { toast } from '../primitives/toastApi';
import { SlotPortal } from '../shared/SlotPortal';
import { ImageFrame } from '../shared/image/ImageFrame';
import { SidebarHeaderMenu } from '../shared/sidebar';
import { FinishCollisionPrompt } from './FinishCollisionPrompt';
import { FinishForm } from './FinishForm';
import { ImportFinishesExcelModal } from './ImportFinishesExcelModal';
import { ImportMaterialsExcelModal } from './ImportMaterialsExcelModal';
import { MaterialForm, ProductLinkIcon } from './MaterialLibraryModal';

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
export const MATERIALS_OPTIONS_SLOT_ID = 'materials-options-slot';
export const MATERIALS_HEADER_VIEW_SLOT_ID = 'materials-header-view-slot';
export const MATERIALS_FINISHES_PANEL_SLOT_ID = 'materials-finishes-panel-slot';

export function MaterialsView({ project, tool: _tool = 'ffe' }: MaterialsViewProps) {
  const queryClient = useQueryClient();
  const isDesktop = useDesktopBreakpoint();

  const finishes = useFinishes(project.id);
  const materials = useMaterials(project.id);
  const createFinish = useCreateFinish(project.id);
  const updateFinish = useUpdateFinish(project.id);
  const deleteFinish = useDeleteFinish(project.id);
  const createMaterial = useCreateMaterial(project.id);
  const updateMaterial = useUpdateMaterial(project.id);
  const deleteMaterial = useDeleteMaterial(project.id);
  const uploadImage = useUploadImage();

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [materialsQuery, setMaterialsQuery] = useState('');
  const [finishesQuery, setFinishesQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showFinishesPanel, setShowFinishesPanel] = useState(false);
  const [draggingFinishId, setDraggingFinishId] = useState<string | null>(null);
  const [dragOverMaterialId, setDragOverMaterialId] = useState<string | null>(null);
  const [applyingMaterialId, setApplyingMaterialId] = useState<string | null>(null);

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

  const editingFinish = finishes.data?.find((finish) => finish.id === editingFinishId);
  const editingMaterial = materials.data?.find((material) => material.id === editingMaterialId);
  const draggingFinish = draggingFinishId
    ? (finishes.data?.find((finish) => finish.id === draggingFinishId) ?? null)
    : null;

  const filteredFinishes = useMemo(() => {
    const normalizedQuery = finishesQuery.trim().toLowerCase();
    return [...(finishes.data ?? [])]
      .filter((finish) => {
        if (categoryFilter === 'uncategorized') return finish.category === null;
        if (categoryFilter !== 'all') return finish.category === categoryFilter;
        return true;
      })
      .filter((finish) => finishMatchesQuery(finish, normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryFilter, finishes.data, finishesQuery]);

  const filteredMaterials = useMemo(() => {
    const normalizedQuery = materialsQuery.trim().toLowerCase();
    return [...(materials.data ?? [])]
      .filter((material) => materialMatchesQuery(material, normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materials.data, materialsQuery]);

  useEffect(() => {
    if (!isDesktop) {
      setDraggingFinishId(null);
      setDragOverMaterialId(null);
      setApplyingMaterialId(null);
    }
  }, [isDesktop]);

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
      for (const image of editingFinishImages.data ?? []) {
        await deleteFinishImage.mutateAsync(image.id);
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

  const handleFinishDelete = async () => {
    if (!editingFinishId) return;
    await deleteFinish.mutateAsync(editingFinishId);
    resetFinishDraft();
  };

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

  const assignFinishToMaterial = async (material: Material, finish: Finish) => {
    if (material.finishId === finish.id || applyingMaterialId) return;

    setApplyingMaterialId(material.id);
    try {
      await updateMaterial.mutateAsync({
        id: material.id,
        patch: { finishId: finish.id },
      });
      toast.success(`Applied ${finish.name} to ${material.name}.`);
    } finally {
      setApplyingMaterialId(null);
      setDragOverMaterialId(null);
      setDraggingFinishId(null);
    }
  };

  const desktopPanelOpen = isDesktop && showFinishesPanel;
  const mobilePanelOpen = !isDesktop && showFinishesPanel;
  const deleteAllCount = deleteAllSelection?.ids.length ?? 0;
  const deleteAllTab = deleteAllSelection?.tab ?? 'materials';
  const deleteAllLabel = deleteAllTab === 'finishes' ? 'finishes' : 'project materials';

  return (
    <div className="grid gap-6">
      <MaterialsToolbarLeft viewMode={viewMode} onViewModeChange={setViewMode} />
      <MaterialsHeaderToggle
        open={showFinishesPanel}
        onToggle={() => setShowFinishesPanel((current) => !current)}
      />
      <MaterialsOptionsMenu
        activeCount={filteredMaterials.length}
        onCreateMaterial={openCreateMaterialForm}
        onImportFromExcel={() => setShowImportMaterialsModal(true)}
        onExport={(format) => handleExport('materials', format)}
        onDeleteAll={() => openDeleteAllModal('materials')}
      />
      <MaterialsToolbarActions
        query={materialsQuery}
        showForm={showMaterialForm}
        onQueryChange={setMaterialsQuery}
        onCreateMaterial={openCreateMaterialForm}
      />

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
                  finish={finishes.data?.find((finish) => finish.id === material.finishId)}
                  isDropTarget={dragOverMaterialId === material.id}
                  dropEnabled={desktopPanelOpen && Boolean(draggingFinish)}
                  onDragOver={(event) => {
                    if (!draggingFinish || !desktopPanelOpen) return;
                    event.preventDefault();
                    setDragOverMaterialId(material.id);
                  }}
                  onDrop={() => {
                    if (!draggingFinish) return;
                    void assignFinishToMaterial(material, draggingFinish);
                  }}
                  onEdit={() => startEditMaterial(material)}
                  onDelete={() => void deleteMaterial.mutateAsync(material.id)}
                />
              ))}
            </div>
          ) : (
            <MaterialsTable
              materials={filteredMaterials}
              finishes={finishes.data ?? []}
              dragOverMaterialId={dragOverMaterialId}
              dropEnabled={desktopPanelOpen && Boolean(draggingFinish)}
              onDragOverMaterial={(material, event) => {
                if (!draggingFinish || !desktopPanelOpen) return;
                event.preventDefault();
                setDragOverMaterialId(material.id);
              }}
              onDropMaterial={(material) => {
                if (!draggingFinish) return;
                void assignFinishToMaterial(material, draggingFinish);
              }}
              onEdit={startEditMaterial}
              onDelete={(material) => void deleteMaterial.mutateAsync(material.id)}
            />
          )}
        </div>
      </section>

      {desktopPanelOpen ? (
        <SlotPortal slotId={MATERIALS_FINISHES_PANEL_SLOT_ID}>
          <DesktopFinishesPanel
            finishes={filteredFinishes}
            allFinishes={finishes.data ?? []}
            loading={finishes.isLoading}
            draggingFinishId={draggingFinishId}
            query={finishesQuery}
            categoryFilter={categoryFilter}
            onQueryChange={setFinishesQuery}
            onCategoryFilterChange={setCategoryFilter}
            onCreateFinish={openCreateFinishForm}
            onEditFinish={startEditFinish}
            onOpenImport={() => setShowImportFinishesModal(true)}
            onExport={(format) => handleExport('finishes', format)}
            onDeleteAll={() => openDeleteAllModal('finishes')}
            onDragStart={(finish, event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', finish.id);
              setDraggingFinishId(finish.id);
            }}
            onDragEnd={() => {
              setDraggingFinishId(null);
              setDragOverMaterialId(null);
            }}
          />
        </SlotPortal>
      ) : null}

      {mobilePanelOpen ? (
        <div className="fixed inset-0 z-[280] flex justify-end bg-neutral-950/20 lg:hidden">
          <button
            type="button"
            aria-label="Close finishes panel backdrop"
            className="flex-1 cursor-default"
            onClick={() => setShowFinishesPanel(false)}
          />
          <div className="relative h-full w-full max-w-[26rem] border-l border-neutral-200 bg-white shadow-2xl">
            <MobileFinishesPanel
              finishes={filteredFinishes}
              allFinishes={finishes.data ?? []}
              loading={finishes.isLoading}
              query={finishesQuery}
              categoryFilter={categoryFilter}
              onQueryChange={setFinishesQuery}
              onCategoryFilterChange={setCategoryFilter}
              onCreateFinish={openCreateFinishForm}
              onEditFinish={startEditFinish}
              onOpenImport={() => setShowImportFinishesModal(true)}
              onExport={(format) => handleExport('finishes', format)}
              onDeleteAll={() => openDeleteAllModal('finishes')}
              onClose={() => setShowFinishesPanel(false)}
            />
          </div>
        </div>
      ) : null}

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
            onDelete={editingFinishId ? () => void handleFinishDelete() : undefined}
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
          {deleteAllTab === 'finishes' ? (
            <p className="text-sm text-danger-700">
              Deleting finishes will not delete project materials, and finish relationships may need
              relinking.
            </p>
          ) : null}
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
      {collisionPrompt ? (
        <FinishCollisionPrompt
          existingFinish={collisionPrompt.existingFinish}
          draftName={collisionPrompt.draftName}
          onUseExisting={() => void handleCollisionDecision('use-existing')}
          onOverwrite={() => void handleCollisionDecision('overwrite')}
          onCancel={() => setCollisionPrompt(null)}
        />
      ) : null}
    </div>
  );
}

function MaterialsToolbarLeft({
  viewMode,
  onViewModeChange,
}: {
  viewMode: 'grid' | 'table';
  onViewModeChange: (value: 'grid' | 'table') => void;
}) {
  return (
    <SlotPortal slotId={MATERIALS_FILTER_SLOT_ID}>
      <div className="project-sidebar-slot gap-2">
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
    </SlotPortal>
  );
}

function MaterialsHeaderToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <SlotPortal slotId={MATERIALS_HEADER_VIEW_SLOT_ID}>
      <Button type="button" variant={open ? 'toolbarPrimary' : 'toolbar'} onClick={onToggle}>
        {open ? 'Close finishes' : 'Open finishes'}
        {open ? (
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </SlotPortal>
  );
}

function MaterialsOptionsMenu({
  activeCount,
  onCreateMaterial,
  onImportFromExcel,
  onExport,
  onDeleteAll,
}: {
  activeCount: number;
  onCreateMaterial: () => void;
  onImportFromExcel: () => void;
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void;
  onDeleteAll: () => void;
}) {
  return (
    <SlotPortal slotId={MATERIALS_OPTIONS_SLOT_ID}>
      <SidebarHeaderMenu ariaLabel="Materials options">
        {({
          closeMenu,
          submenuOpen,
          toggleSubmenu,
          closeSubmenu,
          submenuTriggerRef,
          submenuPanelRef,
          getSubmenuPosition,
        }) => (
          <>
            <MenuItem
              onClick={() => {
                closeMenu();
                onCreateMaterial();
              }}
            >
              New material
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                onImportFromExcel();
              }}
            >
              Upload from Excel
            </MenuItem>
            <MenuSubTrigger
              ref={submenuTriggerRef}
              aria-expanded={submenuOpen}
              onClick={toggleSubmenu}
            >
              Download
            </MenuSubTrigger>
            <MenuSub
              open={submenuOpen}
              panelRef={submenuPanelRef}
              position={getSubmenuPosition({
                align: 'top',
                anchorEdge: 'right',
                panelEdge: 'left',
                offsetY: 0,
                offsetX: 4,
              })}
              className="z-[281] min-w-44"
            >
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  onExport('csv');
                }}
                disabled={activeCount === 0}
              >
                Download CSV
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  onExport('xlsx');
                }}
                disabled={activeCount === 0}
              >
                Download Excel
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  onExport('pdf');
                }}
                disabled={activeCount === 0}
              >
                Download PDF
              </MenuItem>
            </MenuSub>
            <MenuSeparator />
            <MenuItem
              className="text-danger-700"
              disabled={activeCount === 0}
              onClick={() => {
                closeMenu();
                onDeleteAll();
              }}
            >
              Delete all
            </MenuItem>
          </>
        )}
      </SidebarHeaderMenu>
    </SlotPortal>
  );
}

function MaterialsToolbarActions({
  query,
  showForm,
  onQueryChange,
  onCreateMaterial,
}: {
  query: string;
  showForm: boolean;
  onQueryChange: (value: string) => void;
  onCreateMaterial: () => void;
}) {
  return (
    <SlotPortal slotId={MATERIALS_ACTIONS_SLOT_ID}>
      <div className="project-sidebar-slot">
        {!showForm ? (
          <Button
            type="button"
            variant="addAction"
            onClick={onCreateMaterial}
            className="w-full justify-start"
          >
            <Plus className="toolbar-icon" aria-hidden="true" />
            New material
          </Button>
        ) : null}
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search materials"
          className="toolbar-input w-full"
          aria-label="Search project materials"
        />
      </div>
    </SlotPortal>
  );
}

function DesktopFinishesPanel(props: Omit<FinishesPanelProps, 'mobile' | 'onClose'>) {
  return (
    <aside className="project-tool-sidebar no-print hidden shrink-0 border-r border-neutral-200 bg-white lg:sticky lg:top-11 lg:block lg:h-[calc(100vh-44px)] lg:w-[24rem] lg:self-start">
      <div className="flex h-full min-h-0 flex-col">
        <FinishesPanel {...props} mobile={false} />
      </div>
    </aside>
  );
}

function MobileFinishesPanel({
  onClose,
  ...props
}: Omit<FinishesPanelProps, 'mobile' | 'onClose'> & { onClose: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <FinishesPanel {...props} mobile={true} onClose={onClose} />
    </div>
  );
}

type FinishesPanelProps = {
  finishes: Finish[];
  allFinishes: Finish[];
  loading: boolean;
  draggingFinishId?: string | null;
  query: string;
  categoryFilter: CategoryFilter;
  onQueryChange: (value: string) => void;
  onCategoryFilterChange: (value: CategoryFilter) => void;
  onCreateFinish: () => void;
  onEditFinish: (finish: Finish) => void;
  onOpenImport: () => void;
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void;
  onDeleteAll: () => void;
  onDragStart?: (finish: Finish, event: ReactDragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  mobile: boolean;
  onClose?: () => void;
};

function FinishesPanel({
  finishes,
  allFinishes,
  loading,
  draggingFinishId = null,
  query,
  categoryFilter,
  onQueryChange,
  onCategoryFilterChange,
  onCreateFinish,
  onEditFinish,
  onOpenImport,
  onExport,
  onDeleteAll,
  onDragStart,
  onDragEnd,
  mobile,
  onClose,
}: FinishesPanelProps) {
  const emptyMessage =
    allFinishes.length === 0
      ? 'No finishes in the library yet.'
      : 'No finishes match the current filters.';

  return (
    <section aria-label="Finishes panel" className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-neutral-200 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="eyebrow">FINISHES</h2>
            <span className="num text-[11px] font-semibold text-neutral-500">
              {finishes.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <FinishesOptionsMenu
              activeCount={finishes.length}
              onImport={onOpenImport}
              onExport={onExport}
              onDeleteAll={onDeleteAll}
            />
            {mobile && onClose ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <select
            value={categoryFilter}
            onChange={(event) => onCategoryFilterChange(event.target.value as CategoryFilter)}
            className="toolbar-select w-full"
            aria-label="Filter finishes by category"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search finishes"
            className="toolbar-input w-full"
            aria-label="Search finishes"
          />
          <Button
            type="button"
            variant="addAction"
            onClick={onCreateFinish}
            className="w-full justify-start"
          >
            <Plus className="toolbar-icon" aria-hidden="true" />
            New finish
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-4 text-sm text-neutral-500">Loading finishes…</p>
        ) : finishes.length === 0 ? (
          <div className="px-4 py-8">
            <p className="border-y border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
              {emptyMessage}
            </p>
            <div className="mt-4">
              <Button
                type="button"
                variant="addAction"
                onClick={onCreateFinish}
                className="w-full justify-start"
              >
                <Plus className="toolbar-icon" aria-hidden="true" />
                New finish
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {finishes.map((finish) => (
              <FinishListRow
                key={finish.id}
                finish={finish}
                dragging={draggingFinishId === finish.id}
                draggable={!mobile && Boolean(onDragStart)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onEdit={() => onEditFinish(finish)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FinishesOptionsMenu({
  activeCount,
  onImport,
  onExport,
  onDeleteAll,
}: {
  activeCount: number;
  onImport: () => void;
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void;
  onDeleteAll: () => void;
}) {
  return (
    <div className="finishes-options-menu">
      <SidebarHeaderMenu ariaLabel="Finishes options">
        {({
          closeMenu,
          submenuOpen,
          toggleSubmenu,
          closeSubmenu,
          submenuTriggerRef,
          submenuPanelRef,
          getSubmenuPosition,
        }) => (
          <>
            <MenuItem
              onClick={() => {
                closeMenu();
                onImport();
              }}
            >
              Upload from Excel
            </MenuItem>
            <MenuSubTrigger
              ref={submenuTriggerRef}
              aria-expanded={submenuOpen}
              onClick={toggleSubmenu}
            >
              Download
            </MenuSubTrigger>
            <MenuSub
              open={submenuOpen}
              panelRef={submenuPanelRef}
              position={getSubmenuPosition({
                align: 'top',
                anchorEdge: 'right',
                panelEdge: 'left',
                offsetY: 0,
                offsetX: 4,
              })}
              className="z-[281] min-w-44"
            >
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  onExport('csv');
                }}
                disabled={activeCount === 0}
              >
                Download CSV
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  onExport('xlsx');
                }}
                disabled={activeCount === 0}
              >
                Download Excel
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeSubmenu();
                  closeMenu();
                  onExport('pdf');
                }}
                disabled={activeCount === 0}
              >
                Download PDF
              </MenuItem>
            </MenuSub>
            <MenuSeparator />
            <MenuItem
              className="text-danger-700"
              disabled={activeCount === 0}
              onClick={() => {
                closeMenu();
                onDeleteAll();
              }}
            >
              Delete all
            </MenuItem>
          </>
        )}
      </SidebarHeaderMenu>
    </div>
  );
}

function FinishListRow({
  finish,
  dragging,
  draggable,
  onDragStart,
  onDragEnd,
  onEdit,
}: {
  finish: Finish;
  dragging: boolean;
  draggable: boolean;
  onDragStart: ((finish: Finish, event: ReactDragEvent<HTMLElement>) => void) | undefined;
  onDragEnd: (() => void) | undefined;
  onEdit: () => void;
}) {
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart ? (event) => onDragStart(finish, event) : undefined}
      onDragEnd={onDragEnd}
      className={[
        'project-row flex items-center gap-4 px-4 py-3 transition',
        draggable
          ? 'cursor-grab active:cursor-grabbing hover:bg-canvas-shell'
          : 'hover:bg-canvas-shell',
        dragging ? 'bg-brand-50/70 opacity-75' : '',
      ].join(' ')}
      aria-label={draggable ? `Drag finish ${finish.name}` : undefined}
    >
      <div className="flex-shrink-0 overflow-hidden">
        <ImageFrame
          entityType="finish"
          entityId={finish.id}
          alt={finish.name}
          className="h-16 w-16 object-cover"
          placeholderClassName="bg-canvas-shell"
          placeholderContent={
            <span className="text-[10px] font-semibold text-neutral-400">IMG</span>
          }
          compact
          disabled
        />
      </div>
      <div className="flex w-16 shrink-0 flex-col items-start justify-center gap-1">
        <p className="num text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
          {finish.code || 'No code'}
        </p>
        <div className="flex items-center" onMouseDown={(event) => event.stopPropagation()}>
          <ProductLinkIcon url={finish.sourceUrl} label={finish.name} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base font-semibold leading-snug text-neutral-950">
          {finish.name}
        </h3>
        <p className="truncate text-xs text-neutral-500">
          {finish.subCategory ||
            (finish.category ? CATEGORY_LABELS[finish.category] : 'Uncategorized')}
        </p>
      </div>
      <div className="shrink-0" onMouseDown={(event) => event.stopPropagation()}>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </article>
  );
}

function MaterialGridCard({
  material,
  finish,
  isDropTarget,
  dropEnabled,
  onDragOver,
  onDrop,
  onEdit,
  onDelete,
}: {
  material: Material;
  finish?: Finish | undefined;
  isDropTarget: boolean;
  dropEnabled: boolean;
  onDragOver: (event: ReactDragEvent<HTMLElement>) => void;
  onDrop: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      onDragOver={dropEnabled ? onDragOver : undefined}
      onDrop={
        dropEnabled
          ? (event) => {
              event.preventDefault();
              onDrop();
            }
          : undefined
      }
      className={[
        'tile-card flex flex-col transition',
        dropEnabled ? 'outline-none' : '',
        isDropTarget ? 'ring-2 ring-brand-500 ring-offset-2' : '',
      ].join(' ')}
    >
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
          {finish || material.materialType ? (
            <p className="mt-0.5 truncate text-[10px] text-neutral-500">
              {[
                finish?.name,
                material.materialType ? MATERIAL_TYPE_LABELS[material.materialType] : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </div>
        {material.description ? (
          <p className="line-clamp-2 text-xs leading-snug text-neutral-600">
            {material.description}
          </p>
        ) : null}
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

function MaterialsTable({
  materials,
  finishes,
  dragOverMaterialId,
  dropEnabled,
  onDragOverMaterial,
  onDropMaterial,
  onEdit,
  onDelete,
}: {
  materials: Material[];
  finishes: Finish[];
  dragOverMaterialId: string | null;
  dropEnabled: boolean;
  onDragOverMaterial: (material: Material, event: ReactDragEvent<HTMLTableRowElement>) => void;
  onDropMaterial: (material: Material) => void;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
}) {
  const finishById = useMemo(
    () => new Map(finishes.map((finish) => [finish.id, finish])),
    [finishes],
  );

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
            <tr
              key={material.id}
              onDragOver={dropEnabled ? (event) => onDragOverMaterial(material, event) : undefined}
              onDrop={
                dropEnabled
                  ? (event) => {
                      event.preventDefault();
                      onDropMaterial(material);
                    }
                  : undefined
              }
              className={dragOverMaterialId === material.id ? 'bg-brand-50/70' : undefined}
            >
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

function useDesktopBreakpoint() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia !== 'function') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
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
