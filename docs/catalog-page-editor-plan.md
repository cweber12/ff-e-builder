# Catalog Page Editor Plan

Date: 2026-05-26
Owner: UX/UI + Frontend
Scope: Catalog page editing model only

## Objective

Consolidate all meaningful Catalog page editing into one professional Editor window that reduces UI fragmentation, improves usability, and guarantees browser to PDF consistency for typography.

## Current UX Problems

- Editing controls are distributed across multiple surfaces (toolbar, in-canvas controls, inline page affordances).
- Edit mode does not strictly gate text edit behavior, creating accidental-edit risk.
- Font choice in browser does not clearly match export-capable PDF fonts.
- Vertical and horizontal divider toggles produce inconsistent visual alignment.
- Layout controls are not positioned for efficient editing workflow.

## Product Requirements

- Replace Layout action with Editor action in the catalog toolbar.
- Move Add option image functionality into the Editor window.
- Move Add swatch functionality into the Editor window as a button that opens MaterialLibraryModal.
- Text fields are editable only when the Editor is open.
- On the catalog page, only text fields are directly editable.
- Editor window visual design must be clean, organized, and professional.

## Editor Information Architecture

### Section 1: Text

- Enable text editing state while Editor is open.
- Show compact guidance for editable fields.
- Provide optional text reset controls for active page.

### Section 2: Media

- Add option image controls (add/replace/remove option 1 and option 2).
- Add swatch button that launches MaterialLibraryModal for the active item.
- Remove empty-slot add workflows from the page surface.

### Section 3: Typography and Color

- Font selector limited to export-safe fonts only.
- Text color controls for predefined zones:
  - Title and identifiers
  - Specification body text
  - Secondary metadata
- Show export-safe indicator for each selectable style token.

### Section 4: Layout

- Main image alignment
- Plan image size
- Vertical divider toggle
- Horizontal divider toggle
- Divider preview guidance so users understand visual impact

### Section 5: Watermark

- Keep existing watermark controls and place them in this section.

## Interaction Model

- Editor closed:
  - Catalog page is read-only preview.
  - No media add actions on page surface.
- Editor open:
  - Text fields can enter inline edit mode.
  - All non-text changes are initiated in Editor.
- Escape closes Editor when focus is not in a text input.
- Keyboard tab order follows section order.

## Data and State Model

Introduce a unified editor state object for catalog page settings.

Proposed shape:

- editorOpen: boolean
- content:
  - showCostInfo: boolean
  - showSwatchLabels: boolean
  - showApproval: boolean
- media:
  - optionSlots: array metadata
- typography:
  - fontFamily: ExportSafeFontKey
  - titleColorToken: string
  - bodyColorToken: string
  - metaColorToken: string
- layout:
  - mainImageAlignment: center | top
  - planImageSize: thumbnail | expanded
  - showVerticalDivider: boolean
  - showHorizontalDivider: boolean
- watermark:
  - enabled: boolean
  - placementH: left | center | right
  - placementV: header | footer
  - opacity: number

## Export-Safe Font Policy

- Only fonts that can be rendered in catalog PDF export are shown in the Editor.
- If a font cannot be embedded for PDF, it cannot be selected in browser UI.
- Initial rollout uses Source Sans 3 only.
- Future fonts require dual registration:
  - Browser style token mapping
  - jsPDF font registration mapping

## Divider Alignment Strategy

- Use shared geometry tokens for both vertical and horizontal divider rendering.
- Remove offset hacks that rely on negative margins for visual compensation.
- Align divider start and end bounds to the same page grid used by content blocks.
- Ensure parity between browser preview and PDF output.

## Implementation Phases

### Phase 1: Editor shell and behavior gating

- Rename Layout button label and semantics to Editor.
- Create Editor panel shell with section scaffolding.
- Add editable gating to InlineTextEdit usage on Catalog page.

### Phase 2: Media migration

- Remove in-page option-add affordances.
- Add option management controls to Editor Media section.
- Add single Add swatch button that opens MaterialLibraryModal.

### Phase 3: Typography and color

- Add typography config to catalog editor state.
- Implement export-safe font list and selector.
- Add controlled color token selectors and apply to preview.

### Phase 4: Divider and layout cleanup

- Normalize divider rendering geometry.
- Remove in-canvas layout micro-toggles and keep controls in Editor.
- Validate layout parity in browser and PDF outputs.

## Acceptance Criteria

- Catalog toolbar uses Editor action instead of Layout.
- Editor window is the single control center for page editing.
- Add option image and Add swatch actions exist only in Editor.
- Text edits are possible only while Editor is open.
- Only text fields are directly editable on catalog page.
- Font selector only contains export-safe options.
- Divider alignment is consistent and grid-true.
- Editor presentation is clean, organized, and professional.

## Validation Checklist

- UX walk-through for first-time and repeat users
- Keyboard navigation and focus behavior test
- Screen preview and PDF visual parity review
- Regression checks for catalog export and item editing
- Snapshot/test updates for catalog UI changes
