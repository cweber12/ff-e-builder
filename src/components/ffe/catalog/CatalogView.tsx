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
type CatalogMainImageSize = 'thumbnail' | 'expanded';
type CatalogCostDisplay = 'qtyOnly' | 'cost';
type CatalogToggleValue = 'shown' | 'hidden';

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
  const [mainImageSize, setMainImageSize] = useCatalogSessionPreference<CatalogMainImageSize>(
    `ffe-catalog-main-image-size:${project.id}`,
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
  const entries = useMemo(() => flattenCatalogEntries(rooms, sortMode), [rooms, sortMode]);
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const pageIndex = clampPageIndex(requestedPage - 1, entries.length);
  const entry = entries[pageIndex];
  const [slideDirection, setSlideDirection] = useState<'next' | 'previous'>('next');

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
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 border-y border-dashed border-black/15 bg-canvas-chrome px-6 py-14 text-center">
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
        watermarkConfig={watermarkConfig}
        logoDataUrl={logoDataUrl}
        companyName={companyName}
        mainImageAlignment={mainImageAlignment}
        onMainImageAlignmentChange={setMainImageAlignment}
        mainImageSize={mainImageSize}
        onMainImageSizeChange={setMainImageSize}
        showCostInfo={costDisplay === 'cost'}
        onShowCostInfoChange={(showCostInfo) => setCostDisplay(showCostInfo ? 'cost' : 'qtyOnly')}
        showSwatchLabels={swatchLabelDisplay === 'shown'}
        onShowSwatchLabelsChange={(showSwatchLabels) =>
          setSwatchLabelDisplay(showSwatchLabels ? 'shown' : 'hidden')
        }
        showApproval={approvalDisplay === 'shown'}
        onShowApprovalChange={(showApproval) =>
          setApprovalDisplay(showApproval ? 'shown' : 'hidden')
        }
        onWatermarkChange={updateWatermark}
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
            watermarkConfig={watermarkConfig}
            onWatermarkChange={updateWatermark}
            logoDataUrl={logoDataUrl}
            companyName={companyName}
            mainImageAlignment={mainImageAlignment}
            mainImageSize={mainImageSize}
            showCostInfo={costDisplay === 'cost'}
            showSwatchLabels={swatchLabelDisplay === 'shown'}
            showApproval={approvalDisplay === 'shown'}
            onShowApprovalChange={(showApproval) =>
              setApprovalDisplay(showApproval ? 'shown' : 'hidden')
            }
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
            watermarkConfig={watermarkConfig}
            logoDataUrl={logoDataUrl}
            companyName={companyName}
            watermarkInteractive={false}
            mainImageAlignment={mainImageAlignment}
            mainImageSize={mainImageSize}
            showCostInfo={costDisplay === 'cost'}
            showSwatchLabels={swatchLabelDisplay === 'shown'}
            showApproval={approvalDisplay === 'shown'}
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
  watermarkConfig,
  logoDataUrl,
  companyName,
  mainImageAlignment,
  onMainImageAlignmentChange,
  mainImageSize,
  onMainImageSizeChange,
  showCostInfo,
  onShowCostInfoChange,
  showSwatchLabels,
  onShowSwatchLabelsChange,
  showApproval,
  onShowApprovalChange,
  onWatermarkChange,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentIndex: number;
  total: number;
  currentEntry: CatalogEntry | undefined;
  currentItemId: string | undefined;
  onPageChange: (index: number) => void;
  watermarkConfig: WatermarkConfig;
  logoDataUrl: string | null;
  companyName: string | null;
  mainImageAlignment: CatalogImageAlignment;
  onMainImageAlignmentChange: (alignment: CatalogImageAlignment) => void;
  mainImageSize: CatalogMainImageSize;
  onMainImageSizeChange: (size: CatalogMainImageSize) => void;
  showCostInfo: boolean;
  onShowCostInfoChange: (showCostInfo: boolean) => void;
  showSwatchLabels: boolean;
  onShowSwatchLabelsChange: (showSwatchLabels: boolean) => void;
  showApproval: boolean;
  onShowApprovalChange: (showApproval: boolean) => void;
  onWatermarkChange: (update: Partial<WatermarkConfig>) => void;
}) {
  let itemIndex = 0;

  return (
    <nav className="no-print sticky top-0 z-20 mx-auto mb-6 max-w-5xl border-b border-black/10 bg-canvas-bg/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {currentEntry?.room.name && <p className="eyebrow truncate">{currentEntry.room.name}</p>}
          <p className="mt-0.5 truncate font-display text-base font-semibold tracking-tight text-neutral-950">
            {currentEntry?.item.itemName ?? 'Catalog'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={currentIndex === 0}
            aria-label="Previous catalog item"
            onClick={() => onPageChange(currentIndex - 1)}
          >
            <span aria-hidden="true">&lt;</span>
            <span className="sr-only">Previous</span>
          </Button>
          <label className="sr-only" htmlFor="catalog-jump">
            Jump to catalog item
          </label>
          <select
            id="catalog-jump"
            value={currentIndex}
            onChange={(event) => onPageChange(Number(event.target.value))}
            className="min-w-56 rounded-sm border border-black/15 bg-canvas-chrome px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
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
            <span aria-hidden="true">&gt;</span>
            <span className="sr-only">Next</span>
          </Button>
          <CatalogActionsMenu
            project={project}
            rooms={rooms}
            currentItemId={currentItemId}
            watermarkConfig={watermarkConfig}
            logoDataUrl={logoDataUrl}
            companyName={companyName}
            mainImageAlignment={mainImageAlignment}
            onMainImageAlignmentChange={onMainImageAlignmentChange}
            mainImageSize={mainImageSize}
            onMainImageSizeChange={onMainImageSizeChange}
            showCostInfo={showCostInfo}
            onShowCostInfoChange={onShowCostInfoChange}
            showSwatchLabels={showSwatchLabels}
            onShowSwatchLabelsChange={onShowSwatchLabelsChange}
            showApproval={showApproval}
            onShowApprovalChange={onShowApprovalChange}
            onWatermarkChange={onWatermarkChange}
          />
        </div>
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
      <span className="sr-only">{project.name}</span>
    </nav>
  );
}

function CatalogActionsMenu({
  project,
  rooms,
  currentItemId,
  watermarkConfig,
  logoDataUrl,
  companyName,
  mainImageAlignment,
  onMainImageAlignmentChange,
  mainImageSize,
  onMainImageSizeChange,
  showCostInfo,
  onShowCostInfoChange,
  showSwatchLabels,
  onShowSwatchLabelsChange,
  showApproval,
  onShowApprovalChange,
  onWatermarkChange,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentItemId: string | undefined;
  watermarkConfig: WatermarkConfig;
  logoDataUrl: string | null;
  companyName: string | null;
  mainImageAlignment: CatalogImageAlignment;
  onMainImageAlignmentChange: (alignment: CatalogImageAlignment) => void;
  mainImageSize: CatalogMainImageSize;
  onMainImageSizeChange: (size: CatalogMainImageSize) => void;
  showCostInfo: boolean;
  onShowCostInfoChange: (showCostInfo: boolean) => void;
  showSwatchLabels: boolean;
  onShowSwatchLabelsChange: (showSwatchLabels: boolean) => void;
  showApproval: boolean;
  onShowApprovalChange: (showApproval: boolean) => void;
  onWatermarkChange: (update: Partial<WatermarkConfig>) => void;
}) {
  const { sortMode } = useFfeItemSort(project.id);
  const [surface, setSurface] = useState<'closed' | 'menu' | 'layout'>('closed');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (surface === 'closed') return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setSurface('closed');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [surface]);

  const runAction = (action: () => void) => {
    setSurface('closed');
    action();
  };

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
    mainImageAlignment,
    mainImageSize,
    showCostInfo,
    showSwatchLabels,
    showApproval,
    sortMode,
    watermark: watermarkOpts,
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={surface !== 'closed'}
        aria-label="Open catalog options menu"
        onClick={() => setSurface((current) => (current === 'menu' ? 'closed' : 'menu'))}
        className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-black/10 bg-canvas-chrome text-neutral-600 shadow-sm hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <MoreIcon />
      </button>
      {surface === 'menu' && (
        <div
          role="menu"
          aria-label="Catalog options"
          className="catalog-actions-dropdown menu-panel"
        >
          <button
            type="button"
            role="menuitem"
            className="menu-item catalog-actions-dropdown-item"
            onClick={() => setSurface('layout')}
          >
            Layout
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item catalog-actions-dropdown-item"
            onClick={() => runAction(() => window.print())}
          >
            Print
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item catalog-actions-dropdown-item"
            onClick={() => runAction(() => void exportCatalogPdf(project, rooms, exportOptions))}
          >
            Export PDF
          </button>
          {currentItemId ? (
            <button
              type="button"
              role="menuitem"
              className="menu-item catalog-actions-dropdown-item"
              onClick={() =>
                runAction(
                  () => void exportCatalogItemPdf(project, rooms, currentItemId, exportOptions),
                )
              }
            >
              Export current item
            </button>
          ) : null}
        </div>
      )}
      {surface === 'layout' && (
        <div role="dialog" aria-label="Catalog layout options" className="catalog-layout-popover">
          <div className="catalog-layout-popover-header">
            <div>
              <p className="catalog-layout-eyebrow">Layout</p>
              <h2 className="catalog-layout-title">Catalog options</h2>
            </div>
            <button
              type="button"
              className="catalog-layout-close"
              aria-label="Close layout options"
              onClick={() => setSurface('closed')}
            >
              ×
            </button>
          </div>

          <div className="catalog-layout-section">
            <div className="catalog-layout-grid">
              <LayoutOptionCard label="Main image align">
                <SegmentedToggle
                  ariaLabel="Main image alignment"
                  value={mainImageAlignment}
                  options={[
                    { value: 'center', label: 'Center' },
                    { value: 'top', label: 'Top' },
                  ]}
                  onChange={onMainImageAlignmentChange}
                />
              </LayoutOptionCard>
              <LayoutOptionCard label="Image size">
                <SegmentedToggle
                  ariaLabel="Main image size"
                  value={mainImageSize}
                  options={[
                    { value: 'thumbnail', label: 'Thumb' },
                    { value: 'expanded', label: 'Expanded' },
                  ]}
                  onChange={onMainImageSizeChange}
                />
              </LayoutOptionCard>
              <LayoutOptionCard label="Cost display">
                <SegmentedToggle
                  ariaLabel="Cost display"
                  value={showCostInfo ? 'cost' : 'qtyOnly'}
                  options={[
                    { value: 'qtyOnly', label: 'Qty only' },
                    { value: 'cost', label: 'Qty + cost' },
                  ]}
                  onChange={(value) => onShowCostInfoChange(value === 'cost')}
                />
              </LayoutOptionCard>
              <LayoutOptionCard label="Swatches">
                <SegmentedToggle
                  ariaLabel="Swatch display"
                  value={showSwatchLabels ? 'labels' : 'swatches'}
                  options={[
                    { value: 'labels', label: 'Labels' },
                    { value: 'swatches', label: 'Swatches only' },
                  ]}
                  onChange={(value) => onShowSwatchLabelsChange(value === 'labels')}
                />
              </LayoutOptionCard>
              <LayoutOptionCard label="Client approval">
                <SegmentedToggle
                  ariaLabel="Client approval section"
                  value={showApproval ? 'shown' : 'hidden'}
                  options={[
                    { value: 'shown', label: 'Show' },
                    { value: 'hidden', label: 'Remove' },
                  ]}
                  onChange={(value) => onShowApprovalChange(value === 'shown')}
                />
              </LayoutOptionCard>
            </div>
          </div>

          <div className="catalog-layout-section catalog-watermark-section">
            <div className="catalog-layout-row">
              <div>
                <p className="catalog-layout-label">Watermark</p>
                <p className="catalog-layout-note">
                  {logoDataUrl
                    ? 'Use company mark on export pages.'
                    : 'Add a company logo to enable.'}
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
            <LayoutOptionRow label="Placement">
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
            </LayoutOptionRow>
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
          </div>
        </div>
      )}
    </div>
  );
}

function LayoutOptionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="catalog-layout-card">
      <p className="catalog-layout-label">{label}</p>
      {children}
    </div>
  );
}

function LayoutOptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="catalog-layout-row">
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

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
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
  mainImageAlignment = 'center',
  mainImageSize = 'thumbnail',
  showCostInfo = false,
  showSwatchLabels = true,
  showApproval = true,
  onShowApprovalChange,
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
  mainImageAlignment?: CatalogImageAlignment;
  mainImageSize?: CatalogMainImageSize;
  showCostInfo?: boolean;
  showSwatchLabels?: boolean;
  showApproval?: boolean;
  onShowApprovalChange?: (showApproval: boolean) => void;
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
  const isTopAligned = mainImageAlignment === 'top';
  const isExpandedImage = mainImageSize === 'expanded';
  const lineTotalCents = item.unitCostCents * item.qty;

  return (
    <article
      className="catalog-page mx-auto bg-white text-neutral-950 shadow-xl"
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
        <section className="catalog-main">
          <div
            className={cn(
              'catalog-main-left',
              isTopAligned ? 'catalog-main-left-top' : 'catalog-main-left-center',
            )}
          >
            <div
              className={cn(
                'catalog-image-block',
                isExpandedImage && 'catalog-image-block-expanded',
              )}
            >
              <div
                className={cn(
                  'catalog-rendering-square',
                  isTopAligned ? 'catalog-rendering-square-top' : 'catalog-rendering-square-center',
                  isExpandedImage && 'catalog-rendering-square-expanded',
                )}
                data-main-image-alignment={mainImageAlignment}
                data-main-image-size={mainImageSize}
              >
                <ImageFrame
                  entityType="item"
                  entityId={item.id}
                  alt={item.itemName}
                  fallbackUrl={null}
                  className={cn(
                    'catalog-rendering-frame border-0 shadow-none rounded-none',
                    isExpandedImage && 'catalog-rendering-frame-expanded',
                  )}
                  imageClassName={cn(
                    'catalog-image',
                    isExpandedImage ? '!h-full !w-full' : '!h-auto !w-auto',
                    isTopAligned ? 'catalog-image-top' : 'catalog-image-center',
                  )}
                  placeholderClassName="catalog-placeholder"
                  placeholderContent={<span>{initials(item.itemName)}</span>}
                />
              </div>
              <div
                className={cn(
                  'catalog-qty-band',
                  !showCostInfo && 'catalog-qty-band-compact',
                  isExpandedImage && 'catalog-qty-band-expanded',
                )}
              >
                {showCostInfo ? (
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
                    <span className="catalog-qty-label catalog-qty-label-compact">
                      QTY
                      <span className="catalog-qty-inline-value">{item.qty}</span>
                    </span>
                  </div>
                )}
              </div>
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
                  !showSwatchLabels && 'catalog-materials-row-swatch-only',
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

        <div className="catalog-bottom-row">
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
              <p className="catalog-location-sub">LOCATION AND SNIPPET ARE OPTIONAL</p>
              <div className="catalog-plan-frame">
                <ImageFrame
                  entityType="item_plan"
                  entityId={item.id}
                  alt={`${item.itemName} plan`}
                  fallbackUrl={null}
                  className="border-0 shadow-none h-full w-full rounded-none"
                  placeholderClassName="catalog-plan-placeholder"
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
        shown={showApproval}
        onToggle={() => onShowApprovalChange?.(!showApproval)}
      />

      <footer className="catalog-footer">
        <span>{watermarkConfig?.placementH === 'left' ? watermarkMark : null}</span>
        <span className="catalog-footer-center">
          {watermarkConfig?.placementH === 'center' ? watermarkMark : null}
        </span>
        <span className="catalog-footer-page">
          {watermarkConfig?.placementH === 'right' ? watermarkMark : null}
          PAGE {pageNumber} of {pageCount}
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
      <div className="catalog-approval-row">
        <div className="catalog-approval-field catalog-signature-field">
          <div className="catalog-section-label catalog-approval-label">Client Approval</div>
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
          className="absolute bottom-full left-0 z-50 mb-1 min-w-[7rem] rounded-lg border border-black/10 bg-canvas-chrome py-1 shadow-lg"
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
    <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-lg border border-black/10 bg-canvas-chrome p-3 shadow-xl">
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
                : 'border border-black/10 bg-white text-neutral-600 hover:bg-brand-50',
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
                : 'border border-black/10 bg-white text-neutral-600 hover:bg-brand-50',
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
