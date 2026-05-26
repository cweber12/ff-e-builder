import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn, emptyToNull } from '../../../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cents, formatMoney, type Item, type Project } from '../../../types';
import { exportCatalogPdf, exportCatalogItemPdf } from '../../../lib/export';
import {
  useCompany,
  useDeleteImage,
  useFfeItemSort,
  useImages,
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

type ExportSafeFontKey = 'source-sans-3';
type CatalogColorToken = 'ink-950' | 'ink-800' | 'slate-700';

type CatalogTypographyConfig = {
  fontFamily: ExportSafeFontKey;
  titleColorToken: CatalogColorToken;
  bodyColorToken: CatalogColorToken;
  metaColorToken: CatalogColorToken;
};

type CatalogEditorState = {
  editorOpen: boolean;
  content: {
    showCostInfo: boolean;
    showSwatchLabels: boolean;
    showApproval: boolean;
  };
  media: {
    optionSlots: Array<{ slot: 1 | 2; status: 'empty' | 'filled' }>;
  };
  typography: {
    fontFamily: ExportSafeFontKey;
    titleColorToken: CatalogColorToken;
    bodyColorToken: CatalogColorToken;
    metaColorToken: CatalogColorToken;
  };
  layout: {
    mainImageAlignment: CatalogImageAlignment;
    planImageSize: CatalogPlanImageSize;
    showVerticalDivider: boolean;
    showHorizontalDivider: boolean;
  };
  watermark: WatermarkConfig;
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

const DEFAULT_TYPOGRAPHY_CONFIG: CatalogTypographyConfig = {
  fontFamily: 'source-sans-3',
  titleColorToken: 'ink-950',
  bodyColorToken: 'ink-800',
  metaColorToken: 'slate-700',
};

const EXPORT_SAFE_FONT_OPTIONS: Array<{ value: ExportSafeFontKey; label: string }> = [
  { value: 'source-sans-3', label: 'Source Sans 3' },
];

const COLOR_TOKEN_OPTIONS: Array<{ value: CatalogColorToken; label: string }> = [
  { value: 'ink-950', label: 'Ink 950' },
  { value: 'ink-800', label: 'Ink 800' },
  { value: 'slate-700', label: 'Slate 700' },
];

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
  const [fontFamily, setFontFamily] = useCatalogSessionPreference<ExportSafeFontKey>(
    `ffe-catalog-font-family:${project.id}`,
    DEFAULT_TYPOGRAPHY_CONFIG.fontFamily,
  );
  const [titleColorToken, setTitleColorToken] = useCatalogSessionPreference<CatalogColorToken>(
    `ffe-catalog-title-color-token:${project.id}`,
    DEFAULT_TYPOGRAPHY_CONFIG.titleColorToken,
  );
  const [bodyColorToken, setBodyColorToken] = useCatalogSessionPreference<CatalogColorToken>(
    `ffe-catalog-body-color-token:${project.id}`,
    DEFAULT_TYPOGRAPHY_CONFIG.bodyColorToken,
  );
  const [metaColorToken, setMetaColorToken] = useCatalogSessionPreference<CatalogColorToken>(
    `ffe-catalog-meta-color-token:${project.id}`,
    DEFAULT_TYPOGRAPHY_CONFIG.metaColorToken,
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
  const typographyConfig = useMemo<CatalogTypographyConfig>(
    () => ({
      fontFamily,
      titleColorToken,
      bodyColorToken,
      metaColorToken,
    }),
    [fontFamily, titleColorToken, bodyColorToken, metaColorToken],
  );
  const handleTypographyChange = useCallback(
    (update: Partial<CatalogTypographyConfig>) => {
      if (update.fontFamily) setFontFamily(update.fontFamily);
      if (update.titleColorToken) setTitleColorToken(update.titleColorToken);
      if (update.bodyColorToken) setBodyColorToken(update.bodyColorToken);
      if (update.metaColorToken) setMetaColorToken(update.metaColorToken);
    },
    [setBodyColorToken, setFontFamily, setMetaColorToken, setTitleColorToken],
  );
  const entries = useMemo(() => flattenCatalogEntries(rooms, sortMode), [rooms, sortMode]);
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const pageIndex = clampPageIndex(requestedPage - 1, entries.length);
  const entry = entries[pageIndex];
  const [slideDirection, setSlideDirection] = useState<'next' | 'previous'>('next');
  const [editorOpen, setEditorOpen] = useState(false);

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
  const editorState = useMemo<CatalogEditorState>(
    () => ({
      editorOpen,
      content: {
        showCostInfo: layoutConfig.showCostInfo,
        showSwatchLabels: layoutConfig.showSwatchLabels,
        showApproval: layoutConfig.showApproval,
      },
      media: {
        optionSlots: [
          { slot: 1, status: 'empty' },
          { slot: 2, status: 'empty' },
        ],
      },
      typography: {
        fontFamily: typographyConfig.fontFamily,
        titleColorToken: typographyConfig.titleColorToken,
        bodyColorToken: typographyConfig.bodyColorToken,
        metaColorToken: typographyConfig.metaColorToken,
      },
      layout: {
        mainImageAlignment: layoutConfig.mainImageAlignment,
        planImageSize: layoutConfig.planImageSize,
        showVerticalDivider: layoutConfig.showVerticalDivider,
        showHorizontalDivider: layoutConfig.showHorizontalDivider,
      },
      watermark: watermarkConfig,
    }),
    [editorOpen, layoutConfig, typographyConfig, watermarkConfig],
  );
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
      <CatalogActionsBar
        project={project}
        rooms={rooms}
        currentEntry={entry}
        currentIndex={pageIndex}
        total={entries.length}
        currentItemId={entry?.item.id}
        onLayoutChange={handleLayoutChange}
        watermarkConfig={watermarkConfig}
        onWatermarkChange={updateWatermark}
        logoDataUrl={logoDataUrl}
        companyName={companyName}
        sortMode={sortMode}
        editorState={editorState}
        onEditorOpenChange={setEditorOpen}
        onTypographyChange={handleTypographyChange}
      />

      <CatalogToolbarPicker
        rooms={rooms}
        currentIndex={pageIndex}
        total={entries.length}
        currentEntry={entry}
        onPageChange={setPage}
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
            typographyConfig={typographyConfig}
            onLayoutChange={handleLayoutChange}
            watermarkConfig={watermarkConfig}
            logoDataUrl={logoDataUrl}
            companyName={companyName}
            editorOpen={editorOpen}
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
            typographyConfig={typographyConfig}
            watermarkConfig={watermarkConfig}
            logoDataUrl={logoDataUrl}
            companyName={companyName}
            editorOpen={false}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Portal target ID used by App.tsx to host catalog-specific actions inside
 * the ProjectHeader tab row when on the catalog route.
 */
export const CATALOG_ACTIONS_SLOT_ID = 'ffe-catalog-actions-slot';
export const CATALOG_PICKER_SLOT_ID = 'ffe-catalog-picker-slot';

/**
 * Portal of catalog actions into the project header. Renders Print, unified
 * Export, the Catalog Editor, and the page counter.
 */
function CatalogActionsBar({
  project,
  rooms,
  currentEntry,
  currentIndex,
  total,
  currentItemId,
  onLayoutChange,
  watermarkConfig,
  onWatermarkChange,
  logoDataUrl,
  companyName,
  sortMode,
  editorState,
  onEditorOpenChange,
  onTypographyChange,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentEntry: CatalogEntry | undefined;
  currentIndex: number;
  total: number;
  currentItemId: string | undefined;
  onLayoutChange: (update: Partial<CatalogLayoutConfig>) => void;
  watermarkConfig: WatermarkConfig;
  onWatermarkChange: (update: Partial<WatermarkConfig>) => void;
  logoDataUrl: string | null;
  companyName: string | null;
  sortMode: FfeItemSortMode;
  editorState: CatalogEditorState;
  onEditorOpenChange: (open: boolean) => void;
  onTypographyChange: (update: Partial<CatalogTypographyConfig>) => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Slot is mounted by App.tsx as the actions prop. Look it up after mount
    // and re-check on each render in case it gets remounted.
    const el = document.getElementById(CATALOG_ACTIONS_SLOT_ID);
    setSlot(el);
  }, []);

  if (!slot) return null;

  return createPortal(
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="toolbar"
        aria-label="Print catalog"
        onClick={() => window.print()}
      >
        <PrintIcon />
        Print
      </Button>
      <CatalogExportButton
        project={project}
        rooms={rooms}
        currentItemId={currentItemId}
        layoutConfig={{
          ...editorState.layout,
          ...editorState.content,
        }}
        watermarkConfig={editorState.watermark}
        logoDataUrl={logoDataUrl}
        companyName={companyName}
        sortMode={sortMode}
      />
      <CatalogEditorPanelButton
        project={project}
        currentEntry={currentEntry}
        editorState={editorState}
        onLayoutChange={onLayoutChange}
        watermarkConfig={watermarkConfig}
        onWatermarkChange={onWatermarkChange}
        logoDataUrl={logoDataUrl}
        onEditorOpenChange={onEditorOpenChange}
        onTypographyChange={onTypographyChange}
      />
      <span
        aria-hidden
        className="ml-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500"
      >
        <span className="num text-neutral-950">{currentIndex + 1}</span>
        <span className="text-neutral-300">/</span>
        <span className="num">{total}</span>
      </span>
    </div>,
    slot,
  );
}

function CatalogToolbarPicker({
  rooms,
  currentIndex,
  total,
  currentEntry,
  onPageChange,
}: {
  rooms: RoomWithItems[];
  currentIndex: number;
  total: number;
  currentEntry: CatalogEntry | undefined;
  onPageChange: (index: number) => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(CATALOG_PICKER_SLOT_ID);
    setSlot(el);
  }, []);

  if (!slot) return null;

  return createPortal(
    <CatalogPagePicker
      rooms={rooms}
      currentIndex={currentIndex}
      total={total}
      currentEntry={currentEntry}
      onPageChange={onPageChange}
    />,
    slot,
  );
}

/**
 * Centered item picker for the header toolbar. Includes the room label,
 * previous/next arrows, and the jump dropdown.
 */
function CatalogPagePicker({
  rooms,
  currentIndex,
  total,
  currentEntry,
  onPageChange,
}: {
  rooms: RoomWithItems[];
  currentIndex: number;
  total: number;
  currentEntry: CatalogEntry | undefined;
  onPageChange: (index: number) => void;
}) {
  let itemIndex = 0;

  return (
    <nav aria-label="Catalog page picker" className="no-print flex items-center gap-3">
      {currentEntry?.room.name ? (
        <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500 lg:block">
          <span className="text-neutral-400">Room ·</span>{' '}
          <span className="text-neutral-800">{currentEntry.room.name}</span>
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="toolbar"
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
          className="toolbar-select min-w-56"
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
          variant="toolbar"
          disabled={currentIndex === total - 1}
          aria-label="Next catalog item"
          onClick={() => onPageChange(currentIndex + 1)}
        >
          <ChevronRightIcon />
        </Button>
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

  const swatchesOnlyOptions = { ...exportOptions, showSwatchLabels: false };

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="toolbar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export catalog"
        onClick={() => setOpen((v) => !v)}
      >
        <DownloadIcon />
        Export
        <ChevronDownIcon />
      </Button>
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
          <button
            type="button"
            role="menuitem"
            className="menu-item catalog-actions-dropdown-item"
            onClick={() => run(() => void exportCatalogPdf(project, rooms, swatchesOnlyOptions))}
          >
            Export all pages — swatches only
          </button>
        </div>
      )}
    </div>
  );
}

function CatalogEditorPanelButton({
  project,
  currentEntry,
  editorState,
  onEditorOpenChange,
  onTypographyChange,
  onLayoutChange,
  watermarkConfig,
  onWatermarkChange,
  logoDataUrl,
}: {
  project: Project;
  currentEntry: CatalogEntry | undefined;
  editorState: CatalogEditorState;
  onEditorOpenChange: (open: boolean) => void;
  onTypographyChange: (update: Partial<CatalogTypographyConfig>) => void;
  onLayoutChange: (update: Partial<CatalogLayoutConfig>) => void;
  watermarkConfig: WatermarkConfig;
  onWatermarkChange: (update: Partial<WatermarkConfig>) => void;
  logoDataUrl: string | null;
}) {
  const isOpen = editorState.editorOpen;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onEditorOpenChange(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onEditorOpenChange]);

  return (
    <div ref={ref} className="relative inline-flex">
      <Button
        type="button"
        aria-label={isOpen ? 'Close editor' : 'Open editor'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        variant="toolbar"
        className={cn(isOpen && 'border-brand-500 bg-brand-50 text-brand-700')}
        onClick={() => onEditorOpenChange(!isOpen)}
      >
        <SlidersIcon />
        Editor
      </Button>
      {isOpen && (
        <CatalogEditorPanel
          project={project}
          currentEntry={currentEntry}
          editorState={editorState}
          onTypographyChange={onTypographyChange}
          onLayoutChange={onLayoutChange}
          watermarkConfig={watermarkConfig}
          onWatermarkChange={onWatermarkChange}
          logoDataUrl={logoDataUrl}
          onClose={() => onEditorOpenChange(false)}
        />
      )}
    </div>
  );
}

function CatalogEditorPanel({
  project,
  currentEntry,
  editorState,
  onTypographyChange,
  onLayoutChange,
  watermarkConfig,
  onWatermarkChange,
  logoDataUrl,
  onClose,
}: {
  project: Project;
  currentEntry: CatalogEntry | undefined;
  editorState: CatalogEditorState;
  onTypographyChange: (update: Partial<CatalogTypographyConfig>) => void;
  onLayoutChange: (update: Partial<CatalogLayoutConfig>) => void;
  watermarkConfig: WatermarkConfig;
  onWatermarkChange: (update: Partial<WatermarkConfig>) => void;
  logoDataUrl: string | null;
  onClose: () => void;
}) {
  const layoutConfig: CatalogLayoutConfig = {
    ...DEFAULT_LAYOUT_CONFIG,
    ...editorState.content,
    ...editorState.layout,
  };

  return (
    <div role="dialog" aria-label="Catalog editor" className="catalog-layout-popover">
      <div className="catalog-layout-popover-header">
        <div>
          <p className="catalog-layout-eyebrow">Catalog</p>
          <h2 className="catalog-layout-title">Editor</h2>
        </div>
        <button
          type="button"
          className="catalog-layout-close"
          aria-label="Close editor"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <LayoutGroup label="Text">
        <p className="catalog-layout-note">
          Text fields on the page are editable only while the Editor is open.
        </p>
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

      <LayoutGroup label="Media">
        <p className="catalog-layout-note">
          Option image and swatch controls are being consolidated here.
        </p>
        <CatalogEditorMediaManager project={project} currentEntry={currentEntry} />
      </LayoutGroup>

      <LayoutGroup label="Typography and Color">
        <LayoutRow label="Font">
          <select
            aria-label="Catalog font family"
            value={editorState.typography.fontFamily}
            className="toolbar-select"
            onChange={(event) =>
              onTypographyChange({
                fontFamily: event.target.value as ExportSafeFontKey,
              })
            }
          >
            {EXPORT_SAFE_FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} (export-safe)
              </option>
            ))}
          </select>
        </LayoutRow>
        <LayoutRow label="Title and ID">
          <select
            aria-label="Title color token"
            value={editorState.typography.titleColorToken}
            className="toolbar-select"
            onChange={(event) =>
              onTypographyChange({
                titleColorToken: event.target.value as CatalogColorToken,
              })
            }
          >
            {COLOR_TOKEN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} (export-safe)
              </option>
            ))}
          </select>
        </LayoutRow>
        <LayoutRow label="Body text">
          <select
            aria-label="Body color token"
            value={editorState.typography.bodyColorToken}
            className="toolbar-select"
            onChange={(event) =>
              onTypographyChange({
                bodyColorToken: event.target.value as CatalogColorToken,
              })
            }
          >
            {COLOR_TOKEN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} (export-safe)
              </option>
            ))}
          </select>
        </LayoutRow>
        <LayoutRow label="Metadata">
          <select
            aria-label="Metadata color token"
            value={editorState.typography.metaColorToken}
            className="toolbar-select"
            onChange={(event) =>
              onTypographyChange({
                metaColorToken: event.target.value as CatalogColorToken,
              })
            }
          >
            {COLOR_TOKEN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} (export-safe)
              </option>
            ))}
          </select>
        </LayoutRow>
      </LayoutGroup>

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
        <LayoutRow label="Company name">
          <SegmentedToggle
            ariaLabel="Include company name with watermark"
            value={watermarkConfig.includeName ? 'shown' : 'hidden'}
            options={[
              { value: 'hidden', label: 'Logo only' },
              { value: 'shown', label: 'With name' },
            ]}
            onChange={(value) => onWatermarkChange({ includeName: value === 'shown' })}
          />
        </LayoutRow>
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

function CatalogEditorMediaManager({
  project,
  currentEntry,
}: {
  project: Project;
  currentEntry: CatalogEntry | undefined;
}) {
  const currentItemId = currentEntry?.item.id ?? '';
  const optionImagesQuery = useImages('item_option', currentItemId);
  const optionImages = useMemo(
    () =>
      [...(optionImagesQuery.data ?? [])]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .slice(0, 2),
    [optionImagesQuery.data],
  );
  const uploadOptionImage = useUploadImage('item_option', currentItemId);
  const deleteOptionImage = useDeleteImage('item_option', currentItemId);
  const [isLibraryOpen, setLibraryOpen] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isMutating = uploadOptionImage.isPending || deleteOptionImage.isPending;

  if (!currentEntry) {
    return <p className="catalog-layout-note">Open a catalog page to edit option media.</p>;
  }

  const { item, room } = currentEntry;

  const handleUploadToSlot = async (slotIndex: number, file: File) => {
    if (isMutating) return;
    const existing = optionImages[slotIndex] ?? null;
    try {
      if (existing) {
        await deleteOptionImage.mutateAsync(existing.id);
      }
      await uploadOptionImage.mutateAsync({
        file,
        altText: `${item.itemName} option ${slotIndex + 1}`,
      });
      toast.success(`Updated option ${slotIndex + 1} image.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update option image.';
      toast.error(message);
    }
  };

  return (
    <div className="catalog-layout-group-body">
      {[0, 1].map((slotIndex) => {
        const image = optionImages[slotIndex] ?? null;
        const label = `Option ${slotIndex + 1}`;
        return (
          <div key={slotIndex} className="catalog-layout-option-row">
            <p className="catalog-layout-label">{label}</p>
            <div className="flex items-center gap-2">
              <span className="catalog-layout-note">{image ? 'Filled' : 'Available'}</span>
              <button
                type="button"
                className="catalog-layout-secondary"
                disabled={isMutating}
                onClick={() => inputRefs.current[slotIndex]?.click()}
              >
                {image ? 'Replace' : 'Add'}
              </button>
              {image ? (
                <button
                  type="button"
                  className="catalog-layout-delete"
                  disabled={isMutating}
                  onClick={() => deleteOptionImage.mutate(image.id)}
                >
                  Remove
                </button>
              ) : null}
              <input
                ref={(node) => {
                  inputRefs.current[slotIndex] = node;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleUploadToSlot(slotIndex, file);
                  }
                  event.currentTarget.value = '';
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="catalog-layout-option-row">
        <p className="catalog-layout-label">Finish schedule</p>
        <button
          type="button"
          className="catalog-layout-secondary"
          onClick={() => setLibraryOpen(true)}
        >
          Add swatch
        </button>
      </div>
      <MaterialLibraryModal
        open={isLibraryOpen}
        onClose={() => setLibraryOpen(false)}
        projectId={project.id}
        context="ffe"
        item={item}
        roomId={room.id}
      />
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
    <div role="radiogroup" aria-label={ariaLabel} className="segmented">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active || undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="toolbar-icon">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="toolbar-icon">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="toolbar-icon">
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="toolbar-icon">
      <rect x="5" y="2" width="10" height="6" rx="0.5" />
      <path d="M5 14H3a1 1 0 01-1-1V9a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1h-2" />
      <rect x="5" y="12" width="10" height="6" rx="0.5" />
      <path d="M7 16h6M7 14h6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="toolbar-icon">
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M4 16h12" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="toolbar-icon">
      <path d="M4 6h12M4 10h12M4 14h12" />
      <circle cx="8" cy="6" r="1.75" fill="currentColor" />
      <circle cx="12" cy="10" r="1.75" fill="currentColor" />
      <circle cx="8" cy="14" r="1.75" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="toolbar-icon">
      <path d="M2 2l8 8M10 2 2 10" />
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

export function CatalogPage({
  project,
  entry,
  pageNumber,
  pageCount,
  watermarkConfig,
  logoDataUrl,
  companyName,
  layoutConfig: layoutConfigProp,
  typographyConfig: typographyConfigProp,
  onLayoutChange,
  editorOpen = true,
}: {
  project: Project;
  entry: CatalogEntry;
  pageNumber: number;
  pageCount: number;
  watermarkConfig?: WatermarkConfig;
  logoDataUrl?: string | null;
  companyName?: string | null;
  layoutConfig?: Partial<CatalogLayoutConfig>;
  typographyConfig?: Partial<CatalogTypographyConfig>;
  onLayoutChange?: (update: Partial<CatalogLayoutConfig>) => void;
  editorOpen?: boolean;
}) {
  const { item, room } = entry;
  const updateItem = useUpdateItem(item.roomId);
  const optionImagesQuery = useImages('item_option', item.id);
  const optionImages = useMemo(
    () =>
      [...(optionImagesQuery.data ?? [])]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .slice(0, 2),
    [optionImagesQuery.data],
  );

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
      />
    ) : null;
  const layout: CatalogLayoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...layoutConfigProp };
  const typography: CatalogTypographyConfig = {
    ...DEFAULT_TYPOGRAPHY_CONFIG,
    ...typographyConfigProp,
  };
  const typographyFontFamily =
    typography.fontFamily === DEFAULT_TYPOGRAPHY_CONFIG.fontFamily
      ? undefined
      : resolveCatalogFontFamily(typography.fontFamily);
  const titleTextStyle =
    typography.titleColorToken === DEFAULT_TYPOGRAPHY_CONFIG.titleColorToken
      ? undefined
      : { color: resolveCatalogColorToken(typography.titleColorToken) };
  const bodyTextStyle =
    typography.bodyColorToken === DEFAULT_TYPOGRAPHY_CONFIG.bodyColorToken
      ? undefined
      : { color: resolveCatalogColorToken(typography.bodyColorToken) };
  const metaTextStyle =
    typography.metaColorToken === DEFAULT_TYPOGRAPHY_CONFIG.metaColorToken
      ? undefined
      : { color: resolveCatalogColorToken(typography.metaColorToken) };
  const isTopAligned = layout.mainImageAlignment === 'top';
  const isExpandedPlanImage = layout.planImageSize === 'expanded';
  const lineTotalCents = item.unitCostCents * item.qty;

  return (
    <article
      className={cn(
        'catalog-page mx-auto bg-white text-neutral-950 shadow-xl',
        editorOpen && 'catalog-page--edit-mode',
      )}
      style={typographyFontFamily ? { fontFamily: typographyFontFamily } : undefined}
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
              {item.itemIdTag ? (
                <span className="catalog-header-id" style={titleTextStyle}>
                  {item.itemIdTag}
                </span>
              ) : null}
            </h1>
            <InlineTextEdit
              value={item.itemName}
              editable={editorOpen}
              aria-label={`Name for ${item.itemName}`}
              className="min-w-0 inline-block text-[18px]"
              inputClassName="w-full font-medium uppercase tracking-wide text-gray-800"
              onSave={(value) => saveField('itemName', value, true)}
              renderDisplay={(value) => (
                <span className="catalog-header-name" style={titleTextStyle}>
                  {value.toUpperCase()}
                </span>
              )}
            />
          </div>
        </div>
        <div className="catalog-header-right">
          <p className="catalog-header-project" style={metaTextStyle}>
            {project.name.toUpperCase()}
          </p>
          <p
            className={cn(
              'catalog-header-subtitle',
              !project.projectLocation && 'catalog-header-subtitle-empty',
            )}
            style={metaTextStyle}
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
                      <span className="catalog-qty-label" style={metaTextStyle}>
                        PRODUCT QTY
                      </span>
                      <span className="catalog-qty-label" style={metaTextStyle}>
                        PRICE PER ITEM
                      </span>
                      <span className="catalog-qty-label" style={metaTextStyle}>
                        TOTAL
                      </span>
                    </div>
                    <div className="catalog-qty-value-row">
                      <span className="catalog-qty-value" style={bodyTextStyle}>
                        {item.qty}
                      </span>
                      <span className="catalog-qty-value" style={bodyTextStyle}>
                        {item.unitCostCents > 0 ? formatMoney(cents(item.unitCostCents)) : '—'}
                      </span>
                      <span className="catalog-qty-value" style={bodyTextStyle}>
                        {lineTotalCents > 0 ? formatMoney(cents(lineTotalCents)) : '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="catalog-qty-label-row catalog-qty-label-row-compact">
                    <span
                      className="catalog-qty-inline-value catalog-qty-label-compact"
                      style={metaTextStyle}
                    >
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
            </div>
          </div>

          <div className="catalog-main-right" style={bodyTextStyle}>
            <h2 className="catalog-spec-heading" style={titleTextStyle}>
              PRODUCT SPECIFICATIONS
            </h2>

            <div className="catalog-spec-dim">
              <InlineTextEdit
                value={item.dimensions ?? ''}
                editable={editorOpen}
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
                editable={editorOpen}
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
                  editable={editorOpen}
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
                  editable={editorOpen}
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
              {editorOpen && (
                <p className="catalog-vendor-chip no-print">Preview only — not saved to project</p>
              )}
            </div>

            <div className="catalog-notes-block">
              <InlineTextEdit
                value={item.notes ?? ''}
                editable={editorOpen}
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
              <h2 className="catalog-spec-heading catalog-sub-heading" style={titleTextStyle}>
                FINISH SCHEDULE
              </h2>
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
                  <EmptyMaterialPlaceholder key={`empty-${index}`} />
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
          />
          <div className="catalog-location-block">
            <div className="catalog-location-content">
              <p className="catalog-location-label" style={metaTextStyle}>
                <span className="catalog-location-key" style={metaTextStyle}>
                  LOCATION:
                </span>{' '}
                <span className="catalog-location-value" style={metaTextStyle}>
                  {room.name}
                </span>
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
        editorOpen={editorOpen}
        shown={layout.showApproval}
        onToggle={() => onLayoutChange?.({ showApproval: !layout.showApproval })}
      />

      <footer className="catalog-footer" style={metaTextStyle}>
        <span>{watermarkConfig?.placementH === 'left' ? watermarkMark : null}</span>
        <span className="catalog-footer-center">
          {watermarkConfig?.placementH === 'center' ? watermarkMark : null}
        </span>
        <span className="catalog-footer-page">
          {watermarkConfig?.placementH === 'right' ? watermarkMark : null}
          <span className="catalog-footer-page-num" style={metaTextStyle}>
            PAGE {pageNumber} of {pageCount}
          </span>
        </span>
      </footer>
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

function resolveCatalogFontFamily(font: ExportSafeFontKey): string {
  if (font === 'source-sans-3') {
    return "'Source Sans 3', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";
  }
  return "'Source Sans 3', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";
}

function resolveCatalogColorToken(token: CatalogColorToken): string {
  switch (token) {
    case 'ink-950':
      return '#0a0a0a';
    case 'ink-800':
      return '#262626';
    case 'slate-700':
      return '#374151';
    default:
      return '#0a0a0a';
  }
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
}: {
  itemId: string;
  optionImages: ImageAsset[];
  itemName: string;
}) {
  const slot0 = optionImages[0] ?? null;
  const slot1 = optionImages[1] ?? null;

  return (
    <div className="catalog-options-strip">
      <h2 className="catalog-spec-heading">OPTION RENDERINGS</h2>
      <div className="catalog-option-grid">
        <div className="catalog-option-slot">
          {slot0 ? (
            <>
              <CatalogOptionCard
                image={slot0}
                itemId={itemId}
                itemName={itemName}
                index={0}
                disabled
                checked={false}
                onSelect={() => undefined}
                onUpload={() => undefined}
                onDelete={() => undefined}
              />
              <p className="catalog-option-label">Option 1</p>
            </>
          ) : (
            <div className="catalog-option-ghost" />
          )}
        </div>

        <div className="catalog-option-slot">
          {slot1 ? (
            <>
              <CatalogOptionCard
                image={slot1}
                itemId={itemId}
                itemName={itemName}
                index={1}
                disabled
                checked={false}
                onSelect={() => undefined}
                onUpload={() => undefined}
                onDelete={() => undefined}
              />
              <p className="catalog-option-label">Option 2</p>
            </>
          ) : (
            <div className="catalog-option-ghost" />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyMaterialPlaceholder() {
  return (
    <div className="catalog-material-cell catalog-material-cell-empty" aria-hidden="true">
      <div className="catalog-material-swatch catalog-material-swatch-placeholder" />
      <span className="catalog-material-id">ID</span>
      <span className="catalog-material-name">MATERIAL</span>
      <span className="catalog-material-color">COLOR</span>
    </div>
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
          disabled={disabled}
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

function CatalogApprovalSection({
  shown,
  onToggle,
  editorOpen,
}: {
  shown: boolean;
  onToggle: () => void;
  editorOpen: boolean;
}) {
  if (!shown) {
    if (!editorOpen) return null;
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
        {editorOpen ? (
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
        ) : null}
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
}: {
  logoDataUrl: string;
  companyName: string | null;
  config: WatermarkConfig;
}) {
  return (
    <div className="flex items-center">
      <div
        className="flex items-center gap-1 leading-none"
        style={{ opacity: config.opacity / 100 }}
      >
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
    </div>
  );
}
