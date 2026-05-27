import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, emptyToNull } from '../../../lib/utils';
import {
  cents,
  formatMoney,
  type CropParams,
  type ImageAsset,
  type Item,
  type Project,
  type RoomWithItems,
} from '../../../types';
import { useImages, useUpdateImageCrop, useUpdateItem } from '../../../hooks';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { ImageOptionsMenu } from '../../shared/image/ImageOptionsMenu';
import { CropModal } from '../../shared/image/CropModal';
import { MaterialSwatchImage } from '../../materials';
import { api } from '../../../lib/api';
import {
  resolveCatalogColorToken,
  type CatalogColorToken,
  type CatalogImageAlignment,
  type CatalogPlanImageSize,
} from '../../../lib/export/ffe/catalogTokens';

export type CatalogEntry = {
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

export type WatermarkConfig = {
  enabled: boolean;
  placementH: 'left' | 'center' | 'right';
  placementV: 'header' | 'footer';
  opacity: number; // 0–100
  includeName: boolean;
};

export type CatalogLayoutConfig = {
  mainImageAlignment: CatalogImageAlignment;
  planImageSize: CatalogPlanImageSize;
  showCostInfo: boolean;
  showSwatchLabels: boolean;
  showApproval: boolean;
  showVerticalDivider: boolean;
  showHorizontalDivider: boolean;
  showVendor: boolean;
};

export type ExportSafeFontKey = 'source-sans-3';

export type CatalogTypographyConfig = {
  fontFamily: ExportSafeFontKey;
  titleColorToken: CatalogColorToken;
  bodyColorToken: CatalogColorToken;
  metaColorToken: CatalogColorToken;
};

const DEFAULT_LAYOUT_CONFIG: CatalogLayoutConfig = {
  mainImageAlignment: 'center',
  planImageSize: 'thumbnail',
  showCostInfo: false,
  showSwatchLabels: true,
  showApproval: true,
  showVerticalDivider: false,
  showHorizontalDivider: false,
  showVendor: false,
};

export const DEFAULT_TYPOGRAPHY_CONFIG: CatalogTypographyConfig = {
  fontFamily: 'source-sans-3',
  titleColorToken: 'ink-950',
  bodyColorToken: 'ink-800',
  metaColorToken: 'slate-700',
};

function resolveCatalogFontFamily(font: ExportSafeFontKey): string {
  if (font === 'source-sans-3') {
    return "'Source Sans 3', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";
  }
  return "'Source Sans 3', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";
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

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
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

            {layout.showVendor && (
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
                  <p className="catalog-vendor-chip no-print">
                    Preview only — not saved to project
                  </p>
                )}
              </div>
            )}

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
