import { useState, useRef, useMemo, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { type Project } from '../../../types';
import { useDeleteImage, useImages, useUploadImage } from '../../../hooks';
import { toast } from 'sonner';
import { SegmentedControl } from '../../primitives';
import { MaterialLibraryModal } from '../../materials';
import { type CatalogColorToken } from '../../../lib/export/ffe/catalogTokens';
import {
  type CatalogEntry,
  type WatermarkConfig,
  type CatalogLayoutConfig,
  type ExportSafeFontKey,
  type CatalogTypographyConfig,
} from './CatalogPage';

export type CatalogEditorState = {
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

const EXPORT_SAFE_FONT_OPTIONS: Array<{ value: ExportSafeFontKey; label: string }> = [
  { value: 'source-sans-3', label: 'Source Sans 3' },
];

const COLOR_TOKEN_OPTIONS: Array<{ value: CatalogColorToken; label: string }> = [
  { value: 'ink-950', label: 'Ink 950' },
  { value: 'ink-800', label: 'Ink 800' },
  { value: 'slate-700', label: 'Slate 700' },
];

export function CatalogEditorPanel({
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="toolbar-icon">
      <path d="M2 2l8 8M10 2 2 10" />
    </svg>
  );
}
