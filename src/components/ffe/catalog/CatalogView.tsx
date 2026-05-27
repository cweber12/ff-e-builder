import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SlotPortal } from '../../shared/SlotPortal';
import { cn } from '../../../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type Item, type Project } from '../../../types';
import { exportCatalogPdf, exportCatalogItemPdf } from '../../../lib/export';
import {
  useCompany,
  useCatalogPreference,
  useDeleteImage,
  useFfeItemSort,
  useImages,
  useUploadImage,
  type FfeItemSortMode,
} from '../../../hooks';
import { toast } from 'sonner';
import type { RoomWithItems } from '../../../types';
import { Button, SegmentedControl } from '../../primitives';
import { MaterialLibraryModal } from '../../materials';
import { imageAssetToPngDataUrl } from '../../../lib/export/imageHelpers';
import {
  type CatalogColorToken,
  type CatalogImageAlignment,
  type CatalogPlanImageSize,
} from '../../../lib/export/ffe/catalogTokens';
import {
  CatalogPage,
  type CatalogEntry,
  type WatermarkConfig,
  type CatalogLayoutConfig,
  type ExportSafeFontKey,
  type CatalogTypographyConfig,
  DEFAULT_TYPOGRAPHY_CONFIG,
} from './CatalogPage';

type CatalogViewProps = {
  project: Project;
  rooms: RoomWithItems[];
};

type CatalogCostDisplay = 'qtyOnly' | 'cost';
type CatalogToggleValue = 'shown' | 'hidden';

type CatalogEditorState = {
  editorOpen: boolean;
  layoutConfig: CatalogLayoutConfig;
  media: {
    optionSlots: Array<{ slot: 1 | 2; status: 'empty' | 'filled' }>;
  };
  typography: {
    fontFamily: ExportSafeFontKey;
    titleColorToken: CatalogColorToken;
    bodyColorToken: CatalogColorToken;
    metaColorToken: CatalogColorToken;
  };
  watermark: WatermarkConfig;
};

const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: false,
  placementH: 'left',
  placementV: 'footer',
  opacity: 30,
  includeName: false,
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
  const [mainImageAlignment, setMainImageAlignment] = useCatalogPreference<CatalogImageAlignment>(
    `ffe-catalog-main-image-alignment:${project.id}`,
    'center',
  );
  const [planImageSize, setPlanImageSize] = useCatalogPreference<CatalogPlanImageSize>(
    `ffe-catalog-plan-image-size:${project.id}`,
    'thumbnail',
  );
  const [costDisplay, setCostDisplay] = useCatalogPreference<CatalogCostDisplay>(
    `ffe-catalog-cost-display:${project.id}`,
    'qtyOnly',
  );
  const [swatchLabelDisplay, setSwatchLabelDisplay] = useCatalogPreference<CatalogToggleValue>(
    `ffe-catalog-swatch-labels:${project.id}`,
    'shown',
  );
  const [approvalDisplay, setApprovalDisplay] = useCatalogPreference<CatalogToggleValue>(
    `ffe-catalog-approval:${project.id}`,
    'shown',
  );
  const [verticalDividerDisplay, setVerticalDividerDisplay] =
    useCatalogPreference<CatalogToggleValue>(`ffe-catalog-v-divider:${project.id}`, 'hidden');
  const [horizontalDividerDisplay, setHorizontalDividerDisplay] =
    useCatalogPreference<CatalogToggleValue>(`ffe-catalog-h-divider:${project.id}`, 'hidden');
  const [fontFamily, setFontFamily] = useCatalogPreference<ExportSafeFontKey>(
    `ffe-catalog-font-family:${project.id}`,
    DEFAULT_TYPOGRAPHY_CONFIG.fontFamily,
  );
  const [titleColorToken, setTitleColorToken] = useCatalogPreference<CatalogColorToken>(
    `ffe-catalog-title-color-token:${project.id}`,
    DEFAULT_TYPOGRAPHY_CONFIG.titleColorToken,
  );
  const [bodyColorToken, setBodyColorToken] = useCatalogPreference<CatalogColorToken>(
    `ffe-catalog-body-color-token:${project.id}`,
    DEFAULT_TYPOGRAPHY_CONFIG.bodyColorToken,
  );
  const [metaColorToken, setMetaColorToken] = useCatalogPreference<CatalogColorToken>(
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
      layoutConfig,
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
  return (
    <SlotPortal slotId={CATALOG_ACTIONS_SLOT_ID}>
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
          layoutConfig={editorState.layoutConfig}
          typographyConfig={editorState.typography}
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
      </div>
    </SlotPortal>
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
  return (
    <SlotPortal slotId={CATALOG_PICKER_SLOT_ID}>
      <CatalogPagePicker
        rooms={rooms}
        currentIndex={currentIndex}
        total={total}
        currentEntry={currentEntry}
        onPageChange={onPageChange}
      />
    </SlotPortal>
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
  typographyConfig,
  watermarkConfig,
  logoDataUrl,
  companyName,
  sortMode,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentItemId: string | undefined;
  layoutConfig: CatalogLayoutConfig;
  typographyConfig: CatalogTypographyConfig;
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
    showVerticalDivider: layoutConfig.showVerticalDivider,
    showHorizontalDivider: layoutConfig.showHorizontalDivider,
    titleColorToken: typographyConfig.titleColorToken,
    bodyColorToken: typographyConfig.bodyColorToken,
    metaColorToken: typographyConfig.metaColorToken,
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

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      onEditorOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
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
  const layoutConfig = editorState.layoutConfig;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Catalog editor"
      className="catalog-layout-popover"
    >
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
          <SegmentedControl
            ariaLabel="Cost display"
            value={layoutConfig.showCostInfo ? 'cost' : 'qtyOnly'}
            onChange={(value) => onLayoutChange({ showCostInfo: value === 'cost' })}
          >
            <SegmentedControl.Option value="qtyOnly">Qty only</SegmentedControl.Option>
            <SegmentedControl.Option value="cost">Qty + cost</SegmentedControl.Option>
          </SegmentedControl>
        </LayoutRow>
        <LayoutRow label="Finish labels">
          <SegmentedControl
            ariaLabel="Finish label display"
            value={layoutConfig.showSwatchLabels ? 'labels' : 'swatches'}
            onChange={(value) => onLayoutChange({ showSwatchLabels: value === 'labels' })}
          >
            <SegmentedControl.Option value="labels">Labels</SegmentedControl.Option>
            <SegmentedControl.Option value="swatches">Swatches only</SegmentedControl.Option>
          </SegmentedControl>
        </LayoutRow>
        <LayoutRow label="Client approval">
          <SegmentedControl
            ariaLabel="Client approval section"
            value={layoutConfig.showApproval ? 'shown' : 'hidden'}
            onChange={(value) => onLayoutChange({ showApproval: value === 'shown' })}
          >
            <SegmentedControl.Option value="shown">Show</SegmentedControl.Option>
            <SegmentedControl.Option value="hidden">Remove</SegmentedControl.Option>
          </SegmentedControl>
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
          <SegmentedControl
            ariaLabel="Main image alignment"
            value={layoutConfig.mainImageAlignment}
            onChange={(value) => onLayoutChange({ mainImageAlignment: value })}
          >
            <SegmentedControl.Option value="center">Center</SegmentedControl.Option>
            <SegmentedControl.Option value="top">Top</SegmentedControl.Option>
          </SegmentedControl>
        </LayoutRow>
        <LayoutRow label="Vertical divider">
          <SegmentedControl
            ariaLabel="Vertical divider between image and specs"
            value={layoutConfig.showVerticalDivider ? 'shown' : 'hidden'}
            onChange={(value) => onLayoutChange({ showVerticalDivider: value === 'shown' })}
          >
            <SegmentedControl.Option value="hidden">None</SegmentedControl.Option>
            <SegmentedControl.Option value="shown">Show</SegmentedControl.Option>
          </SegmentedControl>
        </LayoutRow>
        <LayoutRow label="Plan image">
          <SegmentedControl
            ariaLabel="Plan image size"
            value={layoutConfig.planImageSize}
            onChange={(value) => onLayoutChange({ planImageSize: value })}
          >
            <SegmentedControl.Option value="thumbnail">Thumb</SegmentedControl.Option>
            <SegmentedControl.Option value="expanded">Expanded</SegmentedControl.Option>
          </SegmentedControl>
        </LayoutRow>
        <LayoutRow label="Section divider">
          <SegmentedControl
            ariaLabel="Horizontal divider between main and bottom sections"
            value={layoutConfig.showHorizontalDivider ? 'shown' : 'hidden'}
            onChange={(value) => onLayoutChange({ showHorizontalDivider: value === 'shown' })}
          >
            <SegmentedControl.Option value="hidden">None</SegmentedControl.Option>
            <SegmentedControl.Option value="shown">Show</SegmentedControl.Option>
          </SegmentedControl>
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
          <SegmentedControl
            ariaLabel="Include company name with watermark"
            value={watermarkConfig.includeName ? 'shown' : 'hidden'}
            onChange={(value) => onWatermarkChange({ includeName: value === 'shown' })}
          >
            <SegmentedControl.Option value="hidden">Logo only</SegmentedControl.Option>
            <SegmentedControl.Option value="shown">With name</SegmentedControl.Option>
          </SegmentedControl>
        </LayoutRow>
        <LayoutRow label="Placement">
          <SegmentedControl
            ariaLabel="Watermark placement"
            value={`${watermarkConfig.placementV}-${watermarkConfig.placementH}`}
            onChange={(value) => {
              const [placementV, placementH] = value.split('-') as [
                WatermarkConfig['placementV'],
                WatermarkConfig['placementH'],
              ];
              onWatermarkChange({ placementV, placementH, enabled: true });
            }}
          >
            <SegmentedControl.Option value="footer-left">Left</SegmentedControl.Option>
            <SegmentedControl.Option value="footer-center">Center</SegmentedControl.Option>
            <SegmentedControl.Option value="footer-right">Right</SegmentedControl.Option>
            <SegmentedControl.Option value="header-left">Header</SegmentedControl.Option>
          </SegmentedControl>
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
