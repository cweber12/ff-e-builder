import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  SlidersHorizontal,
} from 'lucide-react';
import { SlotPortal } from '../../shared/SlotPortal';
import { cn } from '../../../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type Item, type Project } from '../../../types';
import { exportCatalogPdf, exportCatalogItemPdf } from '../../../lib/export';
import {
  useCompany,
  useCatalogPreference,
  useCatalogSessionPreference,
  useFfeItemSort,
  useImages,
  type FfeItemSortMode,
} from '../../../hooks';
import type { RoomWithItems } from '../../../types';
import { Button, SegmentedControl } from '../../primitives';
import { SidebarButton, SidebarButtonGroup } from '../../shared/sidebar';
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
import { CatalogEditorPanel, type CatalogEditorState } from './CatalogEditorPanel';

type CatalogViewProps = {
  project: Project;
  rooms: RoomWithItems[];
};

type CatalogCostDisplay = 'qtyOnly' | 'cost';
type CatalogToggleValue = 'shown' | 'hidden';
type CatalogZoomValue = '75' | '100' | '125' | '150';

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
  const [vendorDisplay, setVendorDisplay] =
    useCatalogSessionPreference<CatalogToggleValue>('hidden');
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
      showVendor: vendorDisplay === 'shown',
    }),
    [
      mainImageAlignment,
      planImageSize,
      costDisplay,
      swatchLabelDisplay,
      approvalDisplay,
      verticalDividerDisplay,
      horizontalDividerDisplay,
      vendorDisplay,
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
      if ('showVendor' in update) setVendorDisplay(update.showVendor ? 'shown' : 'hidden');
    },
    [
      setMainImageAlignment,
      setPlanImageSize,
      setCostDisplay,
      setSwatchLabelDisplay,
      setApprovalDisplay,
      setVerticalDividerDisplay,
      setHorizontalDividerDisplay,
      setVendorDisplay,
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
  // Address the catalog by item ID (order-independent); fall back to ?page=N.
  const requestedItemId = searchParams.get('item');
  const itemIndex = requestedItemId ? entries.findIndex((e) => e.item.id === requestedItemId) : -1;
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const pageIndex = itemIndex >= 0 ? itemIndex : clampPageIndex(requestedPage - 1, entries.length);
  const entry = entries[pageIndex];
  const [slideDirection, setSlideDirection] = useState<'next' | 'previous'>('next');
  const [editorOpen, setEditorOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useCatalogSessionPreference<CatalogZoomValue>('100');
  const [viewportFitScale, setViewportFitScale] = useState(1);

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

  useEffect(() => {
    const updateViewportFit = () => {
      const header = document.querySelector('[data-project-header="true"]');
      const tabs = document.querySelector('[data-project-header-tabs="true"]');
      const referenceRect = (tabs ?? header)?.getBoundingClientRect();
      const topOffset = referenceRect ? Math.ceil(referenceRect.bottom) : 88;
      const availableHeight = Math.max(window.innerHeight - topOffset - 16, 360);
      setViewportFitScale(Math.min(1, availableHeight / 1056));
    };

    updateViewportFit();
    window.addEventListener('resize', updateViewportFit);
    window.addEventListener('orientationchange', updateViewportFit);
    return () => {
      window.removeEventListener('resize', updateViewportFit);
      window.removeEventListener('orientationchange', updateViewportFit);
    };
  }, []);

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
    const target = entries[clampedIndex];
    if (target) navigate({ search: `?item=${target.item.id}` });
  };

  const requestedZoomScale = Number(zoomLevel) / 100;
  const displayScale = viewportFitScale * requestedZoomScale;
  const scaledPageWidth = 816 * displayScale;
  const scaledPageHeight = 1056 * displayScale;

  if (!entry) {
    return (
      <div className="min-h-screen bg-canvas-bg px-6 py-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 border-y border-dashed border-neutral-200 bg-canvas-chrome px-6 py-14 text-center">
          <p className="eyebrow">Catalog</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950">
            No catalog items yet
          </h1>
          <p className="max-w-md text-sm leading-6 text-neutral-500">
            Add Proposal items to FF&amp;E before creating a printable catalog.
          </p>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-canvas-bg">
      <CatalogActionsBar
        project={project}
        rooms={rooms}
        currentEntry={entry}
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
        currentEntry={entry}
        onPageChange={setPage}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
      />

      <div className="screen-only catalog-stage h-[calc(100vh-88px)]">
        <div
          className="catalog-stage-frame"
          style={{ width: scaledPageWidth, minWidth: scaledPageWidth, height: scaledPageHeight }}
        >
          <button
            type="button"
            className="catalog-stage-nav catalog-stage-nav-left"
            aria-label="Previous catalog item"
            disabled={pageIndex === 0}
            onClick={() => setPage(pageIndex - 1)}
          >
            <ChevronLeft className="catalog-stage-nav-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="catalog-stage-nav catalog-stage-nav-right"
            aria-label="Next catalog item"
            disabled={pageIndex === entries.length - 1}
            onClick={() => setPage(pageIndex + 1)}
          >
            <ChevronRight className="catalog-stage-nav-icon" aria-hidden="true" />
          </button>
          {/* Outer wrapper handles display scale; inner div runs the entrance animation at
              natural coordinates so keyframes never fight the inline transform. */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `scale(${displayScale})`,
              transformOrigin: 'top left',
              transformStyle: 'preserve-3d',
              width: '816px',
              height: '1056px',
            }}
          >
            <div
              key={entry.item.id}
              className={cn(
                'catalog-stage-page',
                slideDirection === 'next' ? 'catalog-page-next' : 'catalog-page-previous',
              )}
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
      <SidebarButtonGroup>
        <SidebarButton type="button" aria-label="Print catalog" onClick={() => window.print()}>
          <Printer className="toolbar-icon" aria-hidden="true" />
          Print
        </SidebarButton>
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
      </SidebarButtonGroup>
    </SlotPortal>
  );
}

function CatalogToolbarPicker({
  rooms,
  currentIndex,
  currentEntry,
  onPageChange,
  zoomLevel,
  onZoomChange,
}: {
  rooms: RoomWithItems[];
  currentIndex: number;
  currentEntry: CatalogEntry | undefined;
  onPageChange: (index: number) => void;
  zoomLevel: CatalogZoomValue;
  onZoomChange: (value: CatalogZoomValue) => void;
}) {
  return (
    <SlotPortal slotId={CATALOG_PICKER_SLOT_ID}>
      <CatalogPagePicker
        rooms={rooms}
        currentIndex={currentIndex}
        currentEntry={currentEntry}
        onPageChange={onPageChange}
        zoomLevel={zoomLevel}
        onZoomChange={onZoomChange}
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
  currentEntry,
  onPageChange,
  zoomLevel,
  onZoomChange,
}: {
  rooms: RoomWithItems[];
  currentIndex: number;
  currentEntry: CatalogEntry | undefined;
  onPageChange: (index: number) => void;
  zoomLevel: CatalogZoomValue;
  onZoomChange: (value: CatalogZoomValue) => void;
}) {
  let itemIndex = 0;

  return (
    <nav aria-label="Catalog page picker" className="no-print catalog-sidebar-picker">
      {currentEntry?.room.name ? (
        <p className="catalog-sidebar-picker-room">
          <span className="text-neutral-400">Category</span>{' '}
          <span className="text-neutral-800">{currentEntry.room.name}</span>
        </p>
      ) : null}
      <label className="sr-only" htmlFor="catalog-jump">
        Jump to catalog item
      </label>
      <select
        id="catalog-jump"
        value={currentIndex}
        onChange={(event) => onPageChange(Number(event.target.value))}
        className="toolbar-select w-full min-w-0"
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
      <div className="catalog-sidebar-zoom-row">
        <span className="catalog-sidebar-zoom-label">Zoom</span>
        <SegmentedControl<CatalogZoomValue>
          value={zoomLevel}
          onChange={onZoomChange}
          ariaLabel="Catalog zoom level"
          variant="toolbar"
          className="catalog-sidebar-zoom-controls [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-center"
        >
          <SegmentedControl.Option value="75">75%</SegmentedControl.Option>
          <SegmentedControl.Option value="100">100%</SegmentedControl.Option>
          <SegmentedControl.Option value="125">125%</SegmentedControl.Option>
          <SegmentedControl.Option value="150">150%</SegmentedControl.Option>
        </SegmentedControl>
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
    <div ref={ref} className="relative w-full">
      <SidebarButton
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export catalog"
        className="justify-start"
        onClick={() => setOpen((v) => !v)}
      >
        <Download className="toolbar-icon" aria-hidden="true" />
        Export
        <ChevronDown className="toolbar-icon" aria-hidden="true" />
      </SidebarButton>
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = ref.current?.contains(target) ?? false;
      const clickedPanel = panelRef.current?.contains(target) ?? false;
      if (clickedTrigger || clickedPanel) return;
      const catalogStage = document.querySelector('.catalog-stage');
      if (!catalogStage || !catalogStage.contains(target)) onEditorOpenChange(false);
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

  useEffect(() => {
    if (!isOpen) return;

    const updateAnchor = () => {
      const sidebar = document.querySelector('.project-tab-toolbar-sidebar');
      const tabs = document.querySelector('[data-project-header-tabs="true"]');
      const triggerRect = ref.current?.getBoundingClientRect();
      const sidebarRect = sidebar?.getBoundingClientRect();
      const tabsRect = tabs?.getBoundingClientRect();

      const anchorX = Math.round((sidebarRect?.right ?? triggerRect?.right ?? 0) + 1);
      const anchorY = Math.round(tabsRect?.bottom ?? triggerRect?.bottom ?? 0);
      setPopoverAnchor({
        left: Math.max(anchorX, 12),
        top: anchorY + 1,
      });
    };

    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [isOpen]);

  return (
    <div ref={ref} className="relative inline-flex w-full">
      <SidebarButton
        type="button"
        aria-label={isOpen ? 'Close editor' : 'Open editor'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        selected={isOpen}
        onClick={() => onEditorOpenChange(!isOpen)}
      >
        <SlidersHorizontal className="toolbar-icon" aria-hidden="true" />
        Editor
      </SidebarButton>
      {isOpen && popoverAnchor
        ? createPortal(
            <CatalogEditorPanel
              project={project}
              currentEntry={currentEntry}
              editorState={editorState}
              onTypographyChange={onTypographyChange}
              onLayoutChange={onLayoutChange}
              watermarkConfig={watermarkConfig}
              onWatermarkChange={onWatermarkChange}
              logoDataUrl={logoDataUrl}
              panelRef={panelRef}
              popoverStyle={{
                left: `${popoverAnchor.left}px`,
                top: `${popoverAnchor.top}px`,
                bottom: 'auto',
                right: 'auto',
                position: 'fixed' as const,
                zIndex: 3200,
                pointerEvents: 'auto',
              }}
              onClose={() => onEditorOpenChange(false)}
            />,
            document.body,
          )
        : null}
    </div>
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
