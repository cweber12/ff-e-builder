import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn, emptyToNull } from '../../../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cents, formatMoney, type Item, type Project } from '../../../types';
import { exportCatalogPdf, exportCatalogItemPdf } from '../../../lib/export';
import {
  useCompany,
  useDeleteImage,
  useFfeItemSort,
  useImages,
  useItemMaterialActions,
  useUpdateImageCrop,
  useUpdateItem,
  useUploadImage,
  type FfeItemSortMode,
} from '../../../hooks';
import { toast } from 'sonner';
import type { RoomWithItems } from '../../../types';
import { Button } from '../../primitives';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { ImageOptionsMenu } from '../../shared/image/ImageOptionsMenu';
import { CropModal } from '../../shared/image/CropModal';
import { MaterialLibraryModal, MaterialSwatchImage } from '../../materials';
import { api } from '../../../lib/api';
import { imageAssetToPngDataUrl } from '../../../lib/export/imageHelpers';
import type { CropParams, ImageAsset } from '../../../types';

type CatalogEntry = {
  item: Item;
  room: RoomWithItems;
};

type EditableCatalogField =
  | 'itemName'
  | 'description'
  | 'category'
  | 'dimensions'
  | 'leadTime'
  | 'notes'
  | 'itemIdTag';

type CatalogViewProps = {
  project: Project;
  rooms: RoomWithItems[];
};

type WatermarkConfig = {
  enabled: boolean;
  placementH: 'left' | 'center' | 'right';
  placementV: 'header' | 'footer';
  opacity: number; // 0–100
  includeName: boolean;
};

type CatalogImageAlignment = 'center' | 'top';
type CatalogPlanImageSize = 'thumbnail' | 'expanded';
type CatalogCostDisplay = 'qtyOnly' | 'cost';
type CatalogToggleValue = 'shown' | 'hidden';

type CatalogLayoutConfig = {
  mainImageAlignment: CatalogImageAlignment;
  planImageSize: CatalogPlanImageSize;
  showCostInfo: boolean;
  showSwatchLabels: boolean;
  showApproval: boolean;
  showVerticalDivider: boolean;
  showHorizontalDivider: boolean;
};

const DEFAULT_LAYOUT_CONFIG: CatalogLayoutConfig = {
  mainImageAlignment: 'center',
  planImageSize: 'thumbnail',
  showCostInfo: false,
  showSwatchLabels: true,
  showApproval: true,
  showVerticalDivider: false,
  showHorizontalDivider: false,
};

const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: false,
  placementH: 'left',
  placementV: 'footer',
  opacity: 30,
  includeName: false,
};

export function CatalogView({ project, rooms }: CatalogViewProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { sortMode } = useFfeItemSort(project.id);
  const [mainImageAlignment, setMainImageAlignment] =
    useCatalogSessionPreference<CatalogImageAlignment>(
      `ffe-catalog-main-image-alignment:${project.id}`,
      'center',
    );
  const [planImageSize, setPlanImageSize] = useCatalogSessionPreference<CatalogPlanImageSize>(
    `ffe-catalog-plan-image-size:${project.id}`,
    'thumbnail',
  );
  const [costDisplay, setCostDisplay] = useCatalogSessionPreference<CatalogCostDisplay>(
    `ffe-catalog-cost-display:${project.id}`,
    'qtyOnly',
  );
  const [swatchLabelDisplay, setSwatchLabelDisplay] =
    useCatalogSessionPreference<CatalogToggleValue>(
      `ffe-catalog-swatch-labels:${project.id}`,
      'shown',
    );
  const [approvalDisplay, setApprovalDisplay] = useCatalogSessionPreference<CatalogToggleValue>(
    `ffe-catalog-approval:${project.id}`,
    'shown',
  );
  const [verticalDividerDisplay, setVerticalDividerDisplay] =
    useCatalogSessionPreference<CatalogToggleValue>(
      `ffe-catalog-v-divider:${project.id}`,
      'hidden',
    );
  const [horizontalDividerDisplay, setHorizontalDividerDisplay] =
    useCatalogSessionPreference<CatalogToggleValue>(
      `ffe-catalog-h-divider:${project.id}`,
      'hidden',
    );
  const layoutConfig = useMemo<CatalogLayoutConfig>(
    () => ({
      mainImageAlignment,
      planImageSize,
      showCostInfo: costDisplay === 'cost',
      showSwatchLabels: swatchLabelDisplay === 'shown',
      showApproval: approvalDisplay === 'shown',
      showVerticalDivider: verticalDividerDisplay === 'shown',
      showHorizontalDivider: horizontalDividerDisplay === 'shown',
    }),
    [
      mainImageAlignment,
      planImageSize,
      costDisplay,
      swatchLabelDisplay,
      approvalDisplay,
      verticalDividerDisplay,
      horizontalDividerDisplay,
    ],
  );
  const handleLayoutChange = useCallback(
    (update: Partial<CatalogLayoutConfig>) => {
      if ('mainImageAlignment' in update) setMainImageAlignment(update.mainImageAlignment);
      if ('planImageSize' in update) setPlanImageSize(update.planImageSize);
      if ('showCostInfo' in update) setCostDisplay(update.showCostInfo ? 'cost' : 'qtyOnly');
      if ('showSwatchLabels' in update)
        setSwatchLabelDisplay(update.showSwatchLabels ? 'shown' : 'hidden');
      if ('showApproval' in update) setApprovalDisplay(update.showApproval ? 'shown' : 'hidden');
      if ('showVerticalDivider' in update)
        setVerticalDividerDisplay(update.showVerticalDivider ? 'shown' : 'hidden');
      if ('showHorizontalDivider' in update)
        setHorizontalDividerDisplay(update.showHorizontalDivider ? 'shown' : 'hidden');
    },
    [
      setMainImageAlignment,
      setPlanImageSize,
      setCostDisplay,
      setSwatchLabelDisplay,
      setApprovalDisplay,
      setVerticalDividerDisplay,
      setHorizontalDividerDisplay,
    ],
  );
  const entries = useMemo(() => flattenCatalogEntries(rooms, sortMode), [rooms, sortMode]);
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const pageIndex = clampPageIndex(requestedPage - 1, entries.length);
  const entry = entries[pageIndex];
  const [slideDirection, setSlideDirection] = useState<'next' | 'previous'>('next');
  const [editMode, setEditMode] = useState(false);

  // ── Company watermark ──────────────────────────────────────────────────────
  const { data: company, isError: companyLoadError } = useCompany();
  const logoImages = useImages('company_logo', company?.id ?? '');
  const primaryLogoAsset = useMemo(
    () => (logoImages.data ?? []).find((img) => img.isPrimary) ?? logoImages.data?.[0] ?? null,
    [logoImages.data],
  );
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>(DEFAULT_WATERMARK);
  const [watermarkInitialized, setWatermarkInitialized] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (watermarkInitialized) return;
    const companySettled = company !== undefined || companyLoadError;
    if (!companySettled) return;
    if (company && !companyLoadError && logoImages.data === undefined) return;
    const hasLogo = (logoImages.data?.length ?? 0) > 0;
    setWatermarkConfig({
      enabled: hasLogo,
      placementH: company?.markPlacementH ?? 'left',
      placementV: company?.markPlacementV ?? 'footer',
      opacity: company?.markOpacity ?? 30,
      includeName: company?.markIncludeName ?? false,
    });
    setWatermarkInitialized(true);
  }, [company, companyLoadError, logoImages.data, watermarkInitialized]);

  useEffect(() => {
    if (!primaryLogoAsset) {
      setLogoDataUrl(null);
      return;
    }
    let cancelled = false;
    void imageAssetToPngDataUrl(primaryLogoAsset).then((url) => {
      if (!cancelled) setLogoDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [primaryLogoAsset]);

  const updateWatermark = useCallback(
    (update: Partial<WatermarkConfig>) => setWatermarkConfig((prev) => ({ ...prev, ...update })),
    [],
  );
  const companyName = company?.name ?? null;
  // ──────────────────────────────────────────────────────────────────────────

  const setPage = (nextIndex: number) => {
    const clampedIndex = clampPageIndex(nextIndex, entries.length);
    setSlideDirection(clampedIndex >= pageIndex ? 'next' : 'previous');
    const nextPage = clampedIndex + 1;
    navigate({ search: `?page=${nextPage}` });
  };

  if (!entry) {
    return (
      <div className="min-h-screen bg-canvas-bg px-6 py-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 border-y border-dashed border-neutral-200 bg-canvas-chrome px-6 py-14 text-center">
          <p className="eyebrow">Catalog</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950">
            No catalog items yet
          </h1>
          <p className="max-w-md text-sm leading-6 text-neutral-500">
            Add FF&amp;E items to locations before creating a printable catalog.
          </p>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas-bg">
      <CatalogNav
        project={project}
        rooms={rooms}
        currentIndex={pageIndex}
        total={entries.length}
        currentEntry={entry}
        currentItemId={entry?.item.id}
        onPageChange={setPage}
        layoutConfig={layoutConfig}
        onLayoutChange={handleLayoutChange}
        watermarkConfig={watermarkConfig}
        onWatermarkChange={updateWatermark}
        logoDataUrl={logoDataUrl}
        companyName={companyName}
        sortMode={sortMode}
        editMode={editMode}
        onEditModeToggle={() => setEditMode((v) => !v)}
      />

      <div className="screen-only catalog-stage">
        <div
          key={entry.item.id}
          className={slideDirection === 'next' ? 'catalog-page-next' : 'catalog-page-previous'}
        >
          <CatalogPage
            project={project}
            entry={entry}
            pageNumber={pageIndex + 1}
            pageCount={entries.length}
            layoutConfig={layoutConfig}
            onLayoutChange={handleLayoutChange}
            watermarkConfig={watermarkConfig}
            onWatermarkChange={updateWatermark}
            logoDataUrl={logoDataUrl}
            companyName={companyName}
            editMode={editMode}
          />
        </div>
      </div>

      <div className="print-only">
        {entries.map((catalogEntry, index) => (
          <CatalogPage
            key={catalogEntry.item.id}
            project={project}
            entry={catalogEntry}
            pageNumber={index + 1}
            pageCount={entries.length}
            layoutConfig={layoutConfig}
            watermarkConfig={watermarkConfig}
            logoDataUrl={logoDataUrl}
            companyName={companyName}
            watermarkInteractive={false}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogNav({
  project,
  rooms,
  currentIndex,
  total,
  currentEntry,
  currentItemId,
  onPageChange,
  layoutConfig,
  onLayoutChange,
  watermarkConfig,
  onWatermarkChange,
  logoDataUrl,
  companyName,
  sortMode,
  editMode,
  onEditModeToggle,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentIndex: number;
  total: number;
  currentEntry: CatalogEntry | undefined;
  currentItemId: string | undefined;
  onPageChange: (index: number) => void;
  layoutConfig: CatalogLayoutConfig;
  onLayoutChange: (update: Partial<CatalogLayoutConfig>) => void;
  watermarkConfig: WatermarkConfig;
  onWatermarkChange: (update: Partial<WatermarkConfig>) => void;
  logoDataUrl: string | null;
  companyName: string | null;
  sortMode: FfeItemSortMode;
  editMode: boolean;
  onEditModeToggle: () => void;
}) {
  let itemIndex = 0;

  return (
    <nav className="no-print sticky top-0 z-20 mx-auto mb-6 max-w-5xl border-b border-neutral-200 bg-canvas-bg/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {currentEntry?.room.name ? (
            <div>
              <p className="catalog-nav-room-eyebrow">Room</p>
              <p className="catalog-nav-room-name">{currentEntry.room.name}</p>
            </div>
          ) : (
            <span className="sr-only">{project.name}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={currentIndex === 0}
            aria-label="Previous catalog item"
            onClick={() => onPageChange(currentIndex - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <label className="sr-only" htmlFor="catalog-jump">
            Jump to catalog item
          </label>
          <select
            id="catalog-jump"
            value={currentIndex}
            onChange={(event) => onPageChange(Number(event.target.value))}
            className="min-w-56 rounded-sm border border-neutral-200 bg-canvas-chrome px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          >
            {rooms.map((room) => (
              <optgroup key={room.id} label={room.name}>
                {room.items.map((item) => {
                  const optionIndex = itemIndex;
                  itemIndex += 1;
                  return (
                    <option key={item.id} value={optionIndex}>
                      {item.itemName}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            disabled={currentIndex === total - 1}
            aria-label="Next catalog item"
            onClick={() => onPageChange(currentIndex + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn('catalog-nav-icon-btn', editMode && 'catalog-nav-icon-btn--active')}
            aria-label={editMode ? 'Exit edit mode' : 'Edit fields'}
            aria-pressed={editMode}
            onClick={onEditModeToggle}
          >
            <EditIcon />
            <span className="catalog-nav-btn-label">{editMode ? 'Editing' : 'Edit'}</span>
          </button>
          <button
            type="button"
            className="catalog-nav-icon-btn"
            aria-label="Print catalog"
            onClick={() => window.print()}
          >
            <PrintIcon />
          </button>
          <CatalogExportButton
            project={project}
            rooms={rooms}
            currentItemId={currentItemId}
            layoutConfig={layoutConfig}
            watermarkConfig={watermarkConfig}
            logoDataUrl={logoDataUrl}
            companyName={companyName}
            sortMode={sortMode}
          />
          <CatalogLayoutPanelButton
            layoutConfig={layoutConfig}
            onLayoutChange={onLayoutChange}
            watermarkConfig={watermarkConfig}
            onWatermarkChange={onWatermarkChange}
            logoDataUrl={logoDataUrl}
          />
          <div className="flex min-w-24 flex-col items-end gap-1.5">
            <span className="num text-sm font-semibold text-neutral-950">
              {currentIndex + 1} / {total}
            </span>
            <div className="h-1 w-24 overflow-hidden bg-canvas-shell">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${total > 0 ? ((currentIndex + 1) / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function CatalogExportButton({
  project,
  rooms,
  currentItemId,
  layoutConfig,
  watermarkConfig,
  logoDataUrl,
  companyName,
  sortMode,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentItemId: string | undefined;
  layoutConfig: CatalogLayoutConfig;
  watermarkConfig: WatermarkConfig;
  logoDataUrl: string | null;
  companyName: string | null;
  sortMode: FfeItemSortMode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const watermarkOpts =
    watermarkConfig.enabled && logoDataUrl
      ? {
          logoDataUrl,
          companyName: watermarkConfig.includeName ? companyName : null,
          placementH: watermarkConfig.placementH,
          placementV: watermarkConfig.placementV,
          opacity: watermarkConfig.opacity,
        }
      : null;

  const exportOptions = {
    mainImageAlignment: layoutConfig.mainImageAlignment,
    planImageSize: layoutConfig.planImageSize,
    showCostInfo: layoutConfig.showCostInfo,
    showSwatchLabels: layoutConfig.showSwatchLabels,
    showApproval: layoutConfig.showApproval,
    sortMode,
    watermark: watermarkOpts,
  };

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="catalog-nav-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export catalog"
        onClick={() => setOpen((v) => !v)}
      >
        <DownloadIcon />
        <span className="catalog-nav-btn-label">Export</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Export options"
          className="catalog-actions-dropdown menu-panel"
        >
          <button
            type="button"
            role="menuitem"
            className="menu-item catalog-actions-dropdown-item"
            onClick={() => run(() => void exportCatalogPdf(project, rooms, exportOptions))}
          >
            Export all pages
          </button>
          {currentItemId ? (
            <button
              type="button"
              role="menuitem"
              className="menu-item catalog-actions-dropdown-item"
              onClick={() =>
                run(() => void exportCatalogItemPdf(project, rooms, currentItemId, exportOptions))
              }
            >
              Export this page
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CatalogLayoutPanelButton({
  layoutConfig,
  onLayoutChange,
  watermarkConfig,
  onWatermarkChange,
  logoDataUrl,
}: {
  layoutConfig: CatalogLayoutConfig;
  onLayoutChange: (update: Partial<CatalogLayoutConfig>) => void;
  watermarkConfig: WatermarkConfig;
  onWatermarkChange: (update: Partial<WatermarkConfig>) => void;
  logoDataUrl: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label="Page layout options"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn('catalog-nav-icon-btn', isOpen && 'catalog-nav-icon-btn--active')}
        onClick={() => setIsOpen((v) => !v)}
      >
        <SlidersIcon />
      </button>
      {isOpen && (
        <CatalogLayoutPanel
          layoutConfig={layoutConfig}
          onLayoutChange={onLayoutChange}
          watermarkConfig={watermarkConfig}
          onWatermarkChange={onWatermarkChange}
          logoDataUrl={logoDataUrl}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function CatalogLayoutPanel({
  layoutConfig,
  onLayoutChange,
  watermarkConfig,
  onWatermarkChange,
  logoDataUrl,
  onClose,
}: {
  layoutConfig: CatalogLayoutConfig;
  onLayoutChange: (update: Partial<CatalogLayoutConfig>) => void;
  watermarkConfig: WatermarkConfig;
  onWatermarkChange: (update: Partial<WatermarkConfig>) => void;
  logoDataUrl: string | null;
  onClose: () => void;
}) {
  return (
    <div role="dialog" aria-label="Catalog layout options" className="catalog-layout-popover">
      <div className="catalog-layout-popover-header">
        <div>
          <p className="catalog-layout-eyebrow">Catalog</p>
          <h2 className="catalog-layout-title">Page options</h2>
        </div>
        <button
          type="button"
          className="catalog-layout-close"
          aria-label="Close layout options"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <LayoutGroup label="Layout">
        <LayoutRow label="Main image">
          <SegmentedToggle
            ariaLabel="Main image alignment"
            value={layoutConfig.mainImageAlignment}
            options={[
              { value: 'center', label: 'Center' },
              { value: 'top', label: 'Top' },
            ]}
            onChange={(value) => onLayoutChange({ mainImageAlignment: value })}
          />
        </LayoutRow>
        <LayoutRow label="Vertical divider">
          <SegmentedToggle
            ariaLabel="Vertical divider between image and specs"
            value={layoutConfig.showVerticalDivider ? 'shown' : 'hidden'}
            options={[
              { value: 'hidden', label: 'None' },
              { value: 'shown', label: 'Show' },
            ]}
            onChange={(value) => onLayoutChange({ showVerticalDivider: value === 'shown' })}
          />
        </LayoutRow>
        <LayoutRow label="Plan image">
          <SegmentedToggle
            ariaLabel="Plan image size"
            value={layoutConfig.planImageSize}
            options={[
              { value: 'thumbnail', label: 'Thumb' },
              { value: 'expanded', label: 'Expanded' },
            ]}
            onChange={(value) => onLayoutChange({ planImageSize: value })}
          />
        </LayoutRow>
        <LayoutRow label="Section divider">
          <SegmentedToggle
            ariaLabel="Horizontal divider between main and bottom sections"
            value={layoutConfig.showHorizontalDivider ? 'shown' : 'hidden'}
            options={[
              { value: 'hidden', label: 'None' },
              { value: 'shown', label: 'Show' },
            ]}
            onChange={(value) => onLayoutChange({ showHorizontalDivider: value === 'shown' })}
          />
        </LayoutRow>
      </LayoutGroup>

      <LayoutGroup label="Content">
        <LayoutRow label="Cost display">
          <SegmentedToggle
            ariaLabel="Cost display"
            value={layoutConfig.showCostInfo ? 'cost' : 'qtyOnly'}
            options={[
              { value: 'qtyOnly', label: 'Qty only' },
              { value: 'cost', label: 'Qty + cost' },
            ]}
            onChange={(value) => onLayoutChange({ showCostInfo: value === 'cost' })}
          />
        </LayoutRow>
        <LayoutRow label="Finish labels">
          <SegmentedToggle
            ariaLabel="Finish label display"
            value={layoutConfig.showSwatchLabels ? 'labels' : 'swatches'}
            options={[
              { value: 'labels', label: 'Labels' },
              { value: 'swatches', label: 'Swatches only' },
            ]}
            onChange={(value) => onLayoutChange({ showSwatchLabels: value === 'labels' })}
          />
        </LayoutRow>
        <LayoutRow label="Client approval">
          <SegmentedToggle
            ariaLabel="Client approval section"
            value={layoutConfig.showApproval ? 'shown' : 'hidden'}
            options={[
              { value: 'shown', label: 'Show' },
              { value: 'hidden', label: 'Remove' },
            ]}
            onChange={(value) => onLayoutChange({ showApproval: value === 'shown' })}
          />
        </LayoutRow>
      </LayoutGroup>

      <LayoutGroup label="Watermark">
        <div className="catalog-layout-watermark-row">
          <div>
            <p className="catalog-layout-label">Company mark</p>
            <p className="catalog-layout-note">
              {logoDataUrl ? 'Apply to all export pages.' : 'Upload a company logo to enable.'}
            </p>
          </div>
          <button
            type="button"
            className={cn('catalog-switch', watermarkConfig.enabled && 'catalog-switch-active')}
            disabled={!logoDataUrl}
            aria-pressed={watermarkConfig.enabled}
            onClick={() => onWatermarkChange({ enabled: !watermarkConfig.enabled })}
          >
            <span className="catalog-switch-knob" />
          </button>
        </div>
        <LayoutRow label="Placement">
          <SegmentedToggle
            ariaLabel="Watermark placement"
            value={`${watermarkConfig.placementV}-${watermarkConfig.placementH}`}
            options={[
              { value: 'footer-left', label: 'Left' },
              { value: 'footer-center', label: 'Center' },
              { value: 'footer-right', label: 'Right' },
              { value: 'header-left', label: 'Header' },
            ]}
            onChange={(value) => {
              const [placementV, placementH] = value.split('-') as [
                WatermarkConfig['placementV'],
                WatermarkConfig['placementH'],
              ];
              onWatermarkChange({ placementV, placementH, enabled: true });
            }}
          />
        </LayoutRow>
        <div className="catalog-opacity-row">
          <div className="catalog-opacity-header">
            <p className="catalog-layout-label">Opacity</p>
            <span className="catalog-opacity-value">{watermarkConfig.opacity}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={watermarkConfig.opacity}
            disabled={!logoDataUrl || !watermarkConfig.enabled}
            onChange={(event) => onWatermarkChange({ opacity: Number(event.target.value) })}
            className="catalog-opacity-slider"
          />
        </div>
        <button
          type="button"
          className="catalog-layout-delete"
          disabled={!watermarkConfig.enabled}
          onClick={() => onWatermarkChange({ enabled: false })}
        >
          Remove watermark
        </button>
      </LayoutGroup>
    </div>
  );
}

function LayoutGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="catalog-layout-group">
      <p className="catalog-layout-group-label">{label}</p>
      <div className="catalog-layout-group-body">{children}</div>
    </div>
  );
}

function LayoutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="catalog-layout-option-row">
      <p className="catalog-layout-label">{label}</p>
      {children}
    </div>
  );
}

function SegmentedToggle<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="catalog-segmented-toggle">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={cn('catalog-segmented-option', value === option.value && 'is-active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M10 3L5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M6 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className="h-3 w-3">
      <path
        d="M2 4l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <rect x="5" y="2" width="10" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5 14H3a1 1 0 01-1-1V9a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1h-2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="5" y="12" width="10" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 16h6M7 14h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 3v10M6 9l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 16h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4 6h12M4 10h12M4 14h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="6" r="1.75" fill="currentColor" />
      <circle cx="12" cy="10" r="1.75" fill="currentColor" />
      <circle cx="8" cy="14" r="1.75" fill="currentColor" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M13.5 3.5l3 3L5.5 17H3v-2.5L13.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M7.5 3.5L8.75 2h2.5L12.5 3.5H16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9a1 1 0 011-1h3.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AlignTopIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CatalogPage({
  project,
  entry,
  pageNumber,
  pageCount,
  watermarkConfig,
  onWatermarkChange,
  logoDataUrl,
  companyName,
  watermarkInteractive = true,
  layoutConfig: layoutConfigProp,
  onLayoutChange,
  editMode = false,
}: {
  project: Project;
  entry: CatalogEntry;
  pageNumber: number;
  pageCount: number;
  watermarkConfig?: WatermarkConfig;
  onWatermarkChange?: (update: Partial<WatermarkConfig>) => void;
  logoDataUrl?: string | null;
  companyName?: string | null;
  watermarkInteractive?: boolean;
  layoutConfig?: Partial<CatalogLayoutConfig>;
  onLayoutChange?: (update: Partial<CatalogLayoutConfig>) => void;
  editMode?: boolean;
}) {
  const { item, room } = entry;
  const updateItem = useUpdateItem(item.roomId);
  const materialActions = useItemMaterialActions({
    kind: 'ffe',
    itemGroupId: room.id,
    projectId: project.id,
  });
  const uploadSwatchImage = useUploadImage();
  const [isLibraryOpen, setLibraryOpen] = useState(false);

  const isSwatchMutating = materialActions.createAndAssign.isPending || uploadSwatchImage.isPending;

  // Refs read by the single document-level paste listener so it always
  // sees the latest state without forcing re-registration on every render.
  const itemRef = useRef(item);
  const isLibraryOpenRef = useRef(isLibraryOpen);
  const isMutatingRef = useRef(isSwatchMutating);
  const armedSlotsRef = useRef(0);
  const inFlightRef = useRef(false);
  useEffect(() => {
    itemRef.current = item;
  }, [item]);
  useEffect(() => {
    isLibraryOpenRef.current = isLibraryOpen;
  }, [isLibraryOpen]);
  useEffect(() => {
    isMutatingRef.current = isSwatchMutating;
  }, [isSwatchMutating]);

  const createAndAssignMutateAsync = materialActions.createAndAssign.mutateAsync;
  const uploadSwatchImageMutateAsync = uploadSwatchImage.mutateAsync;

  const handlePasteSwatchImage = useCallback(
    async (file: File) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const currentItem = itemRef.current;
        const generatedName = `Swatch ${currentItem.materials.length + 1}`;
        const material = await createAndAssignMutateAsync({
          itemId: currentItem.id,
          input: { name: generatedName },
        });
        await uploadSwatchImageMutateAsync({
          entityType: 'material',
          entityId: material.id,
          file,
          altText: material.name,
        });
        toast.success(`Added ${material.name} to the finish library.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add swatch.';
        toast.error(message);
      } finally {
        inFlightRef.current = false;
      }
    },
    [createAndAssignMutateAsync, uploadSwatchImageMutateAsync],
  );

  // Single document-level paste listener for the entire catalog page.
  // Per-slot listeners were unreliable: multiple instances accumulating
  // their own listeners caused stale closures and duplicate handlers.
  // This listener is the *only* paste handler the empty swatch slots use.
  const handlePasteRef = useRef(handlePasteSwatchImage);
  useEffect(() => {
    handlePasteRef.current = handlePasteSwatchImage;
  }, [handlePasteSwatchImage]);

  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      if (isLibraryOpenRef.current) return;
      if (armedSlotsRef.current <= 0) return;
      if (isMutatingRef.current || inFlightRef.current) return;
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void handlePasteRef.current(file);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  const armEmptySlot = useCallback(() => {
    armedSlotsRef.current += 1;
  }, []);
  const disarmEmptySlot = useCallback(() => {
    armedSlotsRef.current = Math.max(0, armedSlotsRef.current - 1);
  }, []);
  const openLibrary = useCallback(() => {
    armedSlotsRef.current = 0;
    setLibraryOpen(true);
  }, []);

  const optionImagesQuery = useImages('item_option', item.id);
  const optionImages = useMemo(
    () =>
      [...(optionImagesQuery.data ?? [])]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .slice(0, 2),
    [optionImagesQuery.data],
  );
  const upload = useUploadImage('item_option', item.id);
  const deleteImage = useDeleteImage('item_option', item.id);
  const optionCount = optionImages.length;
  const isBusy = upload.isPending || deleteImage.isPending;

  const saveField = (field: EditableCatalogField, value: string, required = false) =>
    updateItem
      .mutateAsync({
        id: item.id,
        patch: {
          [field]: required ? value.trim() : emptyToNull(value),
          version: item.version,
        },
      })
      .then(() => undefined);

  // TODO: persist vendor + vendorUrl as Item columns in a follow-up iteration.
  // For now these are stored in localStorage keyed by item id so authors can preview the layout.
  const [vendor, setVendor] = useCatalogPlaceholder(`ffe-catalog-vendor:${item.id}`);
  const [vendorUrl, setVendorUrl] = useCatalogPlaceholder(`ffe-catalog-vendor-url:${item.id}`);
  const hasFooterMark =
    !!watermarkConfig?.enabled && watermarkConfig.placementV === 'footer' && !!logoDataUrl;
  const hasHeaderMark =
    !!watermarkConfig?.enabled && watermarkConfig.placementV === 'header' && !!logoDataUrl;
  const watermarkMark =
    hasFooterMark || hasHeaderMark ? (
      <WatermarkMark
        logoDataUrl={logoDataUrl}
        companyName={watermarkConfig.includeName ? (companyName ?? null) : null}
        config={watermarkConfig}
        onConfigChange={onWatermarkChange ?? (() => undefined)}
        interactive={watermarkInteractive}
      />
    ) : null;
  const layout: CatalogLayoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...layoutConfigProp };
  const isTopAligned = layout.mainImageAlignment === 'top';
  const isExpandedPlanImage = layout.planImageSize === 'expanded';
  const lineTotalCents = item.unitCostCents * item.qty;

  return (
    <article
      className={cn(
        'catalog-page mx-auto bg-white text-neutral-950 shadow-xl',
        editMode && 'catalog-page--edit-mode',
      )}
      aria-label={`${item.itemName} catalog page`}
    >
      <header className={cn('catalog-header', hasHeaderMark && 'relative')}>
        {hasHeaderMark && (
          <div
            className={cn(
              'absolute top-1.5 z-10',
              watermarkConfig?.placementH === 'left' && 'left-3',
              watermarkConfig?.placementH === 'center' && 'left-1/2 -translate-x-1/2',
              watermarkConfig?.placementH === 'right' && 'right-3',
            )}
          >
            {watermarkMark}
          </div>
        )}
        <div className="catalog-header-left">
          <div className="gap-2 flex items-center">
            <h1 className="catalog-header-title">
              {item.itemIdTag ? <span className="catalog-header-id">{item.itemIdTag}</span> : null}
            </h1>
            <InlineTextEdit
              value={item.itemName}
              aria-label={`Name for ${item.itemName}`}
              className="min-w-0 inline-block text-[18px]"
              inputClassName="w-full font-medium uppercase tracking-wide text-gray-800"
              onSave={(value) => saveField('itemName', value, true)}
              renderDisplay={(value) => (
                <span className="catalog-header-name">{value.toUpperCase()}</span>
              )}
            />
          </div>
        </div>
        <div className="catalog-header-right">
          <p className="catalog-header-project">{project.name.toUpperCase()}</p>
          <p
            className={cn(
              'catalog-header-subtitle',
              !project.projectLocation && 'catalog-header-subtitle-empty',
            )}
          >
            {project.projectLocation
              ? project.projectLocation.toUpperCase()
              : 'PROJECT DETAILS - OPTIONAL'}
          </p>
        </div>
      </header>

      <div className="catalog-content-block">
        <section
          className={cn('catalog-main', layout.showVerticalDivider && 'catalog-main--v-divide')}
        >
          <div
            className={cn(
              'catalog-main-left',
              isTopAligned ? 'catalog-main-left-top' : 'catalog-main-left-center',
            )}
          >
            <div className="catalog-image-block">
              <div
                className={cn(
                  'catalog-qty-band',
                  !layout.showCostInfo && 'catalog-qty-band-compact',
                )}
              >
                {layout.showCostInfo ? (
                  <>
                    <div className="catalog-qty-label-row">
                      <span className="catalog-qty-label">PRODUCT QTY</span>
                      <span className="catalog-qty-label">PRICE PER ITEM</span>
                      <span className="catalog-qty-label">TOTAL</span>
                    </div>
                    <div className="catalog-qty-value-row">
                      <span className="catalog-qty-value">{item.qty}</span>
                      <span className="catalog-qty-value">
                        {item.unitCostCents > 0 ? formatMoney(cents(item.unitCostCents)) : '—'}
                      </span>
                      <span className="catalog-qty-value">
                        {lineTotalCents > 0 ? formatMoney(cents(lineTotalCents)) : '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="catalog-qty-label-row catalog-qty-label-row-compact">
                    <span className="catalog-qty-inline-value catalog-qty-label-compact">
                      QTY
                      <span>{item.qty}</span>
                    </span>
                  </div>
                )}
              </div>
              <div className="catalog-image-hover-wrapper">
                <div
                  className={cn(
                    'catalog-rendering-square',
                    isTopAligned
                      ? 'catalog-rendering-square-top'
                      : 'catalog-rendering-square-center',
                  )}
                  data-main-image-alignment={layout.mainImageAlignment}
                >
                  <ImageFrame
                    entityType="item"
                    entityId={item.id}
                    alt={item.itemName}
                    fallbackUrl={null}
                    className="catalog-rendering-frame border-0 shadow-none rounded-none"
                    imageClassName={cn(
                      'catalog-image !h-auto !w-auto',
                      isTopAligned ? 'catalog-image-top' : 'catalog-image-center',
                    )}
                    placeholderClassName="catalog-placeholder catalog-placeholder--dashed"
                    placeholderContent={
                      <div className="catalog-placeholder-upload-hint">
                        <CameraIcon />
                        <span>{initials(item.itemName)}</span>
                      </div>
                    }
                  />
                </div>
              </div>
              {onLayoutChange && (
                <div className="catalog-image-align-toggle no-print">
                  <button
                    type="button"
                    className={cn(
                      'catalog-align-btn',
                      layout.mainImageAlignment === 'center' && 'is-active',
                    )}
                    aria-label="Center image alignment"
                    aria-pressed={layout.mainImageAlignment === 'center'}
                    onClick={() => onLayoutChange({ mainImageAlignment: 'center' })}
                  >
                    <AlignCenterIcon />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'catalog-align-btn',
                      layout.mainImageAlignment === 'top' && 'is-active',
                    )}
                    aria-label="Top image alignment"
                    aria-pressed={layout.mainImageAlignment === 'top'}
                    onClick={() => onLayoutChange({ mainImageAlignment: 'top' })}
                  >
                    <AlignTopIcon />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="catalog-main-right">
            <h2 className="catalog-spec-heading">PRODUCT SPECIFICATIONS</h2>

            <div className="catalog-spec-dim">
              <InlineTextEdit
                value={item.dimensions ?? ''}
                aria-label={`Dimensions for ${item.itemName}`}
                inputClassName="w-full text-sm text-neutral-700"
                onSave={(value) => saveField('dimensions', value)}
                renderDisplay={(value) =>
                  value.trim() ? (
                    <span className="catalog-spec-dim-text">{value}</span>
                  ) : (
                    <span className="catalog-spec-dim-text catalog-placeholder-text">
                      W __&quot; x D __&quot; x H __&quot;
                    </span>
                  )
                }
              />
            </div>

            <div className="catalog-spec-desc">
              <InlineTextEdit
                value={item.description ?? ''}
                aria-label={`Description for ${item.itemName}`}
                className="block"
                multiline
                rows={3}
                inputClassName="w-full text-sm text-neutral-700 leading-snug resize-none"
                onSave={(value) => saveField('description', value)}
                renderDisplay={(value) =>
                  value.trim() ? (
                    <p className="catalog-spec-desc-text">{value}</p>
                  ) : (
                    <p className="catalog-spec-desc-text catalog-placeholder-text">
                      Click to add a description.
                    </p>
                  )
                }
              />
            </div>

            <div className="catalog-vendor-block">
              <div className="catalog-vendor-line">
                <InlineTextEdit
                  value={vendor}
                  aria-label="Vendor"
                  className="min-w-0 flex-1"
                  inputClassName="w-full text-sm uppercase tracking-wide text-neutral-500"
                  onSave={(value) => setVendor(value.trim())}
                  renderDisplay={(value) =>
                    value.trim() ? (
                      <span className="catalog-vendor-text">{value}</span>
                    ) : (
                      <span className="catalog-vendor-text catalog-placeholder-text">
                        VENDOR IF ANY
                      </span>
                    )
                  }
                />
              </div>
              <div className="catalog-vendor-line">
                <InlineTextEdit
                  value={vendorUrl}
                  aria-label="Vendor link"
                  className="min-w-0 flex-1"
                  inputClassName="w-full text-sm uppercase tracking-wide text-neutral-500"
                  onSave={(value) => setVendorUrl(value.trim())}
                  renderDisplay={(value) =>
                    value.trim() ? (
                      <span className="catalog-vendor-text">{value}</span>
                    ) : (
                      <span className="catalog-vendor-text catalog-placeholder-text">
                        LINK IF ANY
                      </span>
                    )
                  }
                />
                {vendorUrl.trim() ? (
                  <a
                    href={vendorUrl.trim()}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="catalog-vendor-link"
                    aria-label="Open vendor link"
                  >
                    <LinkIcon />
                  </a>
                ) : (
                  <span
                    className="catalog-vendor-link catalog-vendor-link-empty"
                    aria-hidden="true"
                  >
                    <LinkIcon />
                  </span>
                )}
              </div>
              {editMode && (
                <p className="catalog-vendor-chip no-print">Preview only — not saved to project</p>
              )}
            </div>

            <div className="catalog-notes-block">
              <InlineTextEdit
                value={item.notes ?? ''}
                aria-label={`Notes for ${item.itemName}`}
                className="block w-full"
                multiline
                rows={3}
                inputClassName="w-full min-h-16 resize-none text-sm leading-snug text-neutral-700"
                onSave={(value) => saveField('notes', value)}
                renderDisplay={(value) =>
                  value.trim() ? (
                    <p className="catalog-notes-text">{value}</p>
                  ) : (
                    <p className="catalog-notes-text catalog-placeholder-text">NOTES</p>
                  )
                }
              />
            </div>
            <div className={cn('justify-self-end', item.materials.length === 0 && 'no-print')}>
              <h2 className="catalog-spec-heading catalog-sub-heading">FINISH SCHEDULE</h2>
              <div
                className={cn(
                  'catalog-materials-row',
                  !layout.showSwatchLabels && 'catalog-materials-row-swatch-only',
                )}
              >
                {item.materials.slice(0, 4).map((material) => (
                  <div key={material.id} className="catalog-material-cell">
                    <div className="catalog-material-swatch">
                      <MaterialSwatchImage material={material} className="!h-[60px] !w-[60px]" />
                    </div>
                    <span className="catalog-material-id">{material.materialId || 'ID'}</span>
                    <span className="catalog-material-name">
                      {material.name?.trim().split(/\s+/)[0] || 'MATERIAL'}
                    </span>
                  </div>
                ))}
                {Array.from({
                  length: Math.max(0, 4 - Math.min(item.materials.length, 4)),
                }).map((_, index) => (
                  <EmptyMaterialSlot
                    key={`empty-${index}`}
                    disabled={isSwatchMutating}
                    onArm={armEmptySlot}
                    onDisarm={disarmEmptySlot}
                    onClick={openLibrary}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div
          className={cn(
            'catalog-bottom-row',
            layout.showHorizontalDivider && 'catalog-bottom-row--divided',
          )}
        >
          <CatalogOptionRenderings
            itemId={item.id}
            optionImages={optionImages}
            itemName={item.itemName}
            isBusy={isBusy}
            onUpload={(file, index) =>
              upload.mutate({ file, altText: `${item.itemName} option ${index + 1}` })
            }
            onDelete={(imageId) => deleteImage.mutate(imageId)}
            onAdd={(file) =>
              upload.mutate({ file, altText: `${item.itemName} option ${optionCount + 1}` })
            }
          />
          <div className="catalog-location-block">
            <div className="catalog-location-content">
              <p className="catalog-location-label">
                <span className="catalog-location-key">LOCATION:</span>{' '}
                <span className="catalog-location-value">{room.name}</span>
              </p>
              <div
                className={cn(
                  'catalog-plan-frame',
                  isExpandedPlanImage && 'catalog-plan-frame-expanded',
                )}
                data-plan-image-size={layout.planImageSize}
              >
                <ImageFrame
                  entityType="item_plan"
                  entityId={item.id}
                  alt={`${item.itemName} plan`}
                  fallbackUrl={null}
                  className="border-0 shadow-none h-full w-full rounded-none"
                  imageClassName="!h-full !w-full object-contain"
                  placeholderClassName="catalog-plan-placeholder catalog-plan-placeholder--dashed"
                  placeholderContent={
                    <span className="catalog-plan-placeholder-text">
                      LOCATION
                      <br />
                      SNIPPET
                    </span>
                  }
                  disabled
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <CatalogApprovalSection
        shown={layout.showApproval}
        onToggle={() => onLayoutChange?.({ showApproval: !layout.showApproval })}
      />

      <footer className="catalog-footer">
        <span>{watermarkConfig?.placementH === 'left' ? watermarkMark : null}</span>
        <span className="catalog-footer-center">
          {watermarkConfig?.placementH === 'center' ? watermarkMark : null}
        </span>
        <span className="catalog-footer-page">
          {watermarkConfig?.placementH === 'right' ? watermarkMark : null}
          <span className="catalog-footer-page-num">
            PAGE {pageNumber} of {pageCount}
          </span>
        </span>
      </footer>
      <MaterialLibraryModal
        open={isLibraryOpen}
        onClose={() => setLibraryOpen(false)}
        projectId={project.id}
        context="ffe"
        item={item}
        roomId={room.id}
      />
    </article>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M11.5 8.5l-3 3M8.5 6l1.4-1.4a3 3 0 014.24 4.24L12.74 10.3M11.5 14l-1.4 1.4a3 3 0 01-4.24-4.24L7.26 9.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Persistent localStorage-backed placeholder for the vendor / vendor link fields.
// TODO: Replace with a real Item column (and migration) in a follow-up iteration.
function useCatalogPlaceholder(key: string): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable — silently ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

function useCatalogSessionPreference<T extends string>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, defaultValue);
    } catch {
      /* storage unavailable — silently ignore */
    }
    setValue(defaultValue);
  }, [defaultValue, key]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      /* storage unavailable — silently ignore */
    }
  }, [key, value]);

  return [value, setValue];
}

function CatalogOptionRenderings({
  itemId,
  optionImages,
  itemName,
  isBusy,
  onUpload,
  onDelete,
  onAdd,
}: {
  itemId: string;
  optionImages: ImageAsset[];
  itemName: string;
  isBusy: boolean;
  onUpload: (file: File, index: number) => void;
  onDelete: (imageId: string) => void;
  onAdd: (file: File) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const slot0 = optionImages[0] ?? null;
  const slot1 = optionImages[1] ?? null;

  return (
    <div className="catalog-options-strip">
      <h2 className="catalog-spec-heading">OPTION RENDERINGS</h2>
      <div className="catalog-option-grid">
        {/* Slot 0: card when filled, upload slot when empty */}
        <div className="catalog-option-slot">
          {slot0 ? (
            <>
              <CatalogOptionCard
                image={slot0}
                itemId={itemId}
                itemName={itemName}
                index={0}
                disabled={isBusy}
                checked={selectedId === slot0.id}
                onSelect={(id) => setSelectedId(id)}
                onUpload={(file) => onUpload(file, 0)}
                onDelete={onDelete}
              />
              <p className="catalog-option-label">Option 1</p>
            </>
          ) : (
            <CatalogUploadSlot label="Add option" disabled={isBusy} onFile={onAdd} />
          )}
        </div>

        {/* Slot 1: always in DOM — card, upload slot, or transparent ghost */}
        <div className="catalog-option-slot">
          {slot1 ? (
            <>
              <CatalogOptionCard
                image={slot1}
                itemId={itemId}
                itemName={itemName}
                index={1}
                disabled={isBusy}
                checked={selectedId === slot1.id}
                onSelect={(id) => setSelectedId(id)}
                onUpload={(file) => onUpload(file, 1)}
                onDelete={onDelete}
              />
              <p className="catalog-option-label">Option 2</p>
            </>
          ) : slot0 ? (
            <CatalogUploadSlot label="Add option 2" disabled={isBusy} onFile={onAdd} />
          ) : (
            <div className="catalog-option-ghost" />
          )}
        </div>
      </div>
    </div>
  );
}

function CatalogUploadSlot({
  label,
  disabled,
  onFile,
  compact = false,
}: {
  label: string;
  disabled?: boolean;
  onFile: (file: File) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);

  useEffect(
    () => () => {
      const handler = pasteHandlerRef.current;
      if (handler) document.removeEventListener('paste', handler);
    },
    [],
  );

  const enablePaste = () => {
    if (disabled || pasteHandlerRef.current) return;
    const handler = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      onFile(file);
    };
    pasteHandlerRef.current = handler;
    document.addEventListener('paste', handler);
  };

  const disablePaste = () => {
    const handler = pasteHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('paste', handler);
    pasteHandlerRef.current = null;
  };

  return (
    <>
      <button
        type="button"
        className={compact ? 'no-print catalog-add-option-btn' : 'no-print catalog-upload-slot'}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={enablePaste}
        onMouseLeave={disablePaste}
        aria-label={label}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && !disabled) onFile(file);
          event.currentTarget.value = '';
        }}
      />
    </>
  );
}

function EmptyMaterialSlot({
  disabled,
  onArm,
  onDisarm,
  onClick,
}: {
  disabled: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onClick: () => void;
}) {
  const [isHovering, setHovering] = useState(false);
  const isArmedRef = useRef(false);

  const arm = () => {
    if (disabled || isArmedRef.current) return;
    isArmedRef.current = true;
    onArm();
  };
  const disarm = () => {
    if (!isArmedRef.current) return;
    isArmedRef.current = false;
    onDisarm();
  };

  useEffect(
    () => () => {
      // On unmount, make sure we release the page-level counter.
      if (isArmedRef.current) {
        isArmedRef.current = false;
        onDisarm();
      }
    },
    [onDisarm],
  );

  // If the slot becomes disabled while armed, drop the arm to prevent paste
  // racing the in-flight mutation.
  useEffect(() => {
    if (disabled && isArmedRef.current) {
      isArmedRef.current = false;
      onDisarm();
    }
  }, [disabled, onDisarm]);

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'no-print catalog-material-cell catalog-material-cell-empty catalog-material-slot-paste',
        isHovering && !disabled && 'catalog-material-slot-paste--hover',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
      aria-label="Add finish swatch — click to open library or paste an image"
      title={
        disabled
          ? 'Adding swatch…'
          : isHovering
            ? 'Click to open library, or press Ctrl+V to paste an image'
            : 'Click to open library, or hover and press Ctrl+V to paste'
      }
      onClick={() => {
        disarm();
        onClick();
      }}
      onMouseEnter={() => {
        setHovering(true);
        arm();
      }}
      onMouseLeave={() => {
        setHovering(false);
        disarm();
      }}
      onFocus={() => {
        setHovering(true);
        arm();
      }}
      onBlur={() => {
        setHovering(false);
        disarm();
      }}
    >
      <div className="catalog-material-swatch catalog-material-swatch-placeholder" />
      <span className="catalog-material-id">ID</span>
      <span className="catalog-material-name">MATERIAL</span>
      <span className="catalog-material-color">
        {isHovering && !disabled ? 'PASTE (CTRL+V)' : 'COLOR'}
      </span>
    </button>
  );
}

function CatalogOptionCard({
  image,
  itemId,
  itemName,
  index,
  disabled,
  checked,
  onSelect,
  onUpload,
  onDelete,
}: {
  image: ImageAsset;
  itemId: string;
  itemName: string;
  index: number;
  disabled?: boolean;
  checked: boolean;
  onSelect: (imageId: string) => void;
  onUpload: (file: File) => void;
  onDelete: (imageId: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const updateCrop = useUpdateImageCrop('item_option', itemId);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);

  const cropParams: CropParams | null =
    image.cropX != null &&
    image.cropY != null &&
    image.cropWidth != null &&
    image.cropHeight != null
      ? {
          cropX: image.cropX,
          cropY: image.cropY,
          cropWidth: image.cropWidth,
          cropHeight: image.cropHeight,
        }
      : null;
  const documentPasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);

  useEffect(() => {
    let ignore = false;
    let nextUrl: string | null = null;

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    void api.images
      .getContentBlob(image.id)
      .then((blob) => {
        if (ignore) return;
        nextUrl = URL.createObjectURL(blob);
        setPreviewUrl(nextUrl);
      })
      .catch(() => {
        if (!ignore) setPreviewUrl(null);
      });

    return () => {
      ignore = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [image.id]);

  useEffect(
    () => () => {
      const handler = documentPasteHandlerRef.current;
      if (handler) document.removeEventListener('paste', handler);
    },
    [],
  );

  const handleFile = (file: File | null | undefined) => {
    if (!file || disabled) return;
    onUpload(file);
  };

  const handleCropSave = (params: CropParams) => {
    updateCrop.mutate({ imageId: image.id, params }, { onSuccess: () => setCropOpen(false) });
  };

  const enablePaste = () => {
    if (disabled || documentPasteHandlerRef.current) return;
    const handler = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      handleFile(file);
    };
    documentPasteHandlerRef.current = handler;
    document.addEventListener('paste', handler);
  };

  const disablePaste = () => {
    const handler = documentPasteHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('paste', handler);
    documentPasteHandlerRef.current = null;
  };

  return (
    <div className="catalog-option-card" onMouseEnter={enablePaste} onMouseLeave={disablePaste}>
      <label className="catalog-option-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => {
            if (!checked) onSelect(image.id);
          }}
        />
      </label>
      <div className="catalog-option-hover-overlay no-print" aria-hidden="true">
        <CameraIcon />
      </div>
      {previewUrl ? (
        <button
          ref={menuAnchorRef}
          type="button"
          disabled={disabled}
          aria-label={`Image options for ${itemName} option ${index + 1}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {cropParams ? (
            <img
              src={previewUrl}
              alt={`${itemName} option ${index + 1}`}
              style={{
                position: 'absolute',
                width: `${(1 / cropParams.cropWidth) * 100}%`,
                height: `${(1 / cropParams.cropHeight) * 100}%`,
                left: `${(-cropParams.cropX / cropParams.cropWidth) * 100}%`,
                top: `${(-cropParams.cropY / cropParams.cropHeight) * 100}%`,
              }}
            />
          ) : (
            <img
              src={previewUrl}
              alt={`${itemName} option ${index + 1}`}
              className="h-full w-full object-contain object-center"
            />
          )}
        </button>
      ) : (
        <div className="catalog-option-empty">
          <span className="text-xs text-neutral-300">Loading…</span>
        </div>
      )}

      <ImageOptionsMenu
        anchorRef={menuAnchorRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        canUpdate={!disabled}
        canCrop={!disabled}
        canDelete={!disabled}
        onUpdate={() => {
          setMenuOpen(false);
          inputRef.current?.click();
        }}
        onCrop={() => {
          setMenuOpen(false);
          setCropOpen(true);
        }}
        onDelete={() => {
          setMenuOpen(false);
          onDelete(image.id);
        }}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      {cropOpen && previewUrl ? (
        <CropModal
          open={cropOpen}
          onClose={() => setCropOpen(false)}
          imageUrl={previewUrl}
          aspect={1}
          onSave={handleCropSave}
          isSaving={updateCrop.isPending}
        />
      ) : null}
    </div>
  );
}

function CatalogApprovalSection({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  if (!shown) {
    return (
      <div className="no-print flex">
        <button type="button" className="catalog-add-approval-btn" onClick={onToggle}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span>Add client approval</span>
        </button>
      </div>
    );
  }

  return (
    <section className="catalog-approval-band">
      <div className="catalog-approval-header">
        <span className="catalog-section-label">CLIENT SIGN-OFF</span>
        <button
          type="button"
          className="no-print catalog-approval-remove"
          aria-label="Remove client approval section"
          onClick={onToggle}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="catalog-approval-row">
        <div className="catalog-approval-field catalog-signature-field">
          <div className="catalog-approval-line" />
          <span>Authorized Signature</span>
        </div>
        <div className="catalog-approval-field catalog-approval-date">
          <div className="catalog-approval-line" />
          <span>Date</span>
        </div>
        <div className="catalog-approval-checks">
          <label>
            <input type="checkbox" className="catalog-approval-check-input" />
            Approved with revisions
          </label>
          <label>
            <input type="checkbox" className="catalog-approval-check-input" />
            Approved as presented
          </label>
        </div>
      </div>
    </section>
  );
}

function flattenCatalogEntries(
  rooms: RoomWithItems[],
  sortMode: FfeItemSortMode = 'manual',
): CatalogEntry[] {
  const itemCompare =
    sortMode === 'idTag'
      ? (() => {
          const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
          return (a: Item, b: Item) => {
            const aId = a.itemIdTag?.trim() ?? '';
            const bId = b.itemIdTag?.trim() ?? '';
            if (aId && bId) {
              return collator.compare(aId, bId) || a.itemName.localeCompare(b.itemName);
            }
            if (aId) return -1;
            if (bId) return 1;
            return a.itemName.localeCompare(b.itemName);
          };
        })()
      : (a: Item, b: Item) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName);
  return [...rooms]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((room) => [...room.items].sort(itemCompare).map((item) => ({ item, room })));
}

function clampPageIndex(index: number, total: number) {
  if (total <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function WatermarkMark({
  logoDataUrl,
  companyName,
  config,
  onConfigChange,
  interactive = true,
}: {
  logoDataUrl: string;
  companyName: string | null;
  config: WatermarkConfig;
  onConfigChange: (update: Partial<WatermarkConfig>) => void;
  interactive?: boolean;
}) {
  const [uiMode, setUiMode] = useState<'idle' | 'options' | 'editing'>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (uiMode === 'idle') return;
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setUiMode('idle');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [uiMode]);

  const markContent = (
    <div className="flex items-center gap-1 leading-none" style={{ opacity: config.opacity / 100 }}>
      <img
        src={logoDataUrl}
        alt="Company mark"
        className="h-5 w-auto max-w-[72px] object-contain"
      />
      {companyName && (
        <span className="text-[8px] uppercase tracking-widest text-neutral-500 font-medium">
          {companyName}
        </span>
      )}
    </div>
  );

  if (!interactive) {
    return <div className="flex items-center">{markContent}</div>;
  }

  return (
    <div ref={containerRef} className="relative inline-flex no-print">
      <button
        type="button"
        className={cn(
          'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          uiMode !== 'idle' && 'ring-2 ring-brand-400 ring-offset-1',
        )}
        aria-label="Company watermark — click to edit"
        onClick={() => setUiMode(uiMode === 'idle' ? 'options' : 'idle')}
      >
        {markContent}
      </button>
      {uiMode === 'options' && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-1 min-w-[7rem] rounded-lg border border-neutral-200 bg-canvas-chrome py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-neutral-700 hover:bg-brand-50 hover:text-brand-700"
            onClick={() => setUiMode('editing')}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              onConfigChange({ enabled: false });
              setUiMode('idle');
            }}
          >
            Delete
          </button>
        </div>
      )}
      {uiMode === 'editing' && (
        <WatermarkEditorPopover
          config={config}
          onChange={onConfigChange}
          onDelete={() => {
            onConfigChange({ enabled: false });
            setUiMode('idle');
          }}
          onClose={() => setUiMode('idle')}
        />
      )}
    </div>
  );
}

function WatermarkEditorPopover({
  config,
  onChange,
  onDelete,
  onClose,
}: {
  config: WatermarkConfig;
  onChange: (update: Partial<WatermarkConfig>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-lg border border-neutral-200 bg-canvas-chrome p-3 shadow-xl">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="eyebrow text-[10px]">Logo Mark</span>
        <button
          type="button"
          aria-label="Close editor"
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-700"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
            className="h-3 w-3"
          >
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </div>
      <label className="mb-2 flex cursor-pointer select-none items-center gap-2 text-xs text-neutral-600">
        <input
          type="checkbox"
          checked={config.includeName}
          onChange={(e) => onChange({ includeName: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
        />
        Include company name
      </label>
      <p className="mb-1 text-[9px] uppercase tracking-wide text-neutral-400">Position</p>
      <div className="mb-2 flex gap-1">
        {(['header', 'footer'] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={cn(
              'flex-1 rounded px-2 py-1 text-[11px] capitalize transition-colors',
              config.placementV === v
                ? 'bg-brand-600 text-white'
                : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-brand-50',
            )}
            onClick={() => onChange({ placementV: v })}
          >
            {v[0]!.toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <div className="mb-2 flex gap-1">
        {(['left', 'center', 'right'] as const).map((h) => (
          <button
            key={h}
            type="button"
            className={cn(
              'flex-1 rounded px-2 py-1 text-[11px] capitalize transition-colors',
              config.placementH === h
                ? 'bg-brand-600 text-white'
                : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-brand-50',
            )}
            onClick={() => onChange({ placementH: h })}
          >
            {h[0]!.toUpperCase() + h.slice(1)}
          </button>
        ))}
      </div>
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wide text-neutral-400">Opacity</span>
          <span className="num text-[10px] text-neutral-600">{config.opacity}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          value={config.opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer accent-brand-600"
        />
      </div>
      <button
        type="button"
        className="w-full rounded border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-600 transition-colors hover:bg-red-100"
        onClick={onDelete}
      >
        Remove Watermark
      </button>
    </div>
  );
}
