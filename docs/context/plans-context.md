# Plans Workspace — Codebase Context

## Purpose

The plans module allows users to:

1. **Upload** architectural plans (image or PDF) for a project
2. **Calibrate** plans by mapping a drawn pixel line to a known real-world measurement
3. **Measure flow** — draw a rectangle on a calibrated plan, link it to a proposal item, optionally crop a plan image and/or apply the computed sq ft to the item's quantity
4. **Highlight flow** — draw a rectangle on a calibrated plan and save a cropped region as the item's plan image (no quantity update; used for unit-cost items)

---

## Project stack

React 18 + TypeScript 5 + Vite 5, Tailwind 3, shadcn/ui primitives, @tanstack/react-query, Firebase Auth → Cloudflare Workers (Hono 4) → Neon Postgres (hand-written SQL via @neondatabase/serverless), pnpm monorepo (`src/` client, `api/` worker).

---

## Routing

Both routes are fully implemented and production-ready:

```tsx
<Route path="plans" element={<ProjectPlansRoute />} />           // → PlansPage
<Route path="plans/:planId" element={<ProjectPlanCanvasRoute />} /> // → PlanCanvasPage
```

`ProjectPlansRoute` and `ProjectPlanCanvasRoute` call `useOutletContext<ProjectContext>()` to receive `project`.

---

## Domain types — `src/types/plan.ts`

```ts
type CalibrationStatus = 'uncalibrated' | 'calibrated';
type PlanMeasurementUnit = 'in' | 'ft' | 'mm' | 'cm' | 'm';

type MeasuredPlan = {
  id;
  projectId;
  ownerUid;
  name;
  sheetReference;
  sourceType: 'image' | 'pdf-page'; // determines which fields below are populated
  // Image fields (sourceType === 'image')
  imageFilename;
  imageContentType;
  imageByteSize;
  // PDF fields (sourceType === 'pdf-page')
  pdfFilename: string | null;
  pdfContentType: string | null;
  pdfByteSize: number | null;
  pdfPageNumber: number | null;
  pdfPageWidthPt: number | null;
  pdfPageHeightPt: number | null;
  pdfRenderScale: number | null;
  pdfRenderedWidthPx: number | null;
  pdfRenderedHeightPx: number | null;
  pdfRotation: number | null;
  // Computed — read-only (SQL LEFT JOIN / COUNT)
  calibrationStatus: CalibrationStatus;
  measurementCount: number;
  createdAt;
  updatedAt;
};

type PlanCalibration = {
  id;
  measuredPlanId;
  startX;
  startY;
  endX;
  endY; // raw pixel coords
  realWorldLength: number; // in plan units
  unit: PlanMeasurementUnit;
  pixelsPerUnit: number; // = pixelLength / realWorldLength
  createdAt;
  updatedAt;
};

type LengthLine = {
  id;
  measuredPlanId;
  startX;
  startY;
  endX;
  endY; // raw pixel coords
  measuredLengthBase: number | null; // mm
  label: string | null;
  createdAt;
  updatedAt;
};

type Measurement = {
  id;
  measuredPlanId;
  targetKind: 'proposal'; // 'ffe' reserved for future use
  targetItemId;
  targetTagSnapshot: string; // fallback display label if item is later deleted; pass MeasurementItemRef.targetTagSnapshot
  rectX;
  rectY;
  rectWidth;
  rectHeight; // raw pixel coords
  horizontalSpanBase: number; // mm
  verticalSpanBase: number; // mm
  cropX;
  cropY;
  cropWidth;
  cropHeight; // normalized 0–1 fractions (nullable)
  createdAt;
  updatedAt;
};
```

**Coordinate systems — never mix:**

- `rectX/Y/Width/Height`, `startX/Y/endX/Y` → **raw pixels** in plan image space
- `cropX/Y/Width/Height` → **normalized 0–1 fractions** relative to natural image size
- `*SpanBase`, `measuredLengthBase` → **millimeters** (canonical unit for all spans)

---

## Workflows

### 1. Upload a plan — `src/components/plans/list/PlanUploadModal.tsx`

**Image path:** file picker → name/sheet ref → `useCreateMeasuredPlan` → `POST /:id/plans`

**PDF path:** file picker → `renderPdfThumbnails()` generates page previews → user picks page → `renderPdfPageAsPngFile({ file, pageNumber, scale: 2 })` renders PNG → name/sheet ref → `useCreateMeasuredPlan` with both `file` (PNG) and `sourcePdfFile` (original PDF)

The worker stores both the PNG and original PDF in R2 and writes all PDF metadata to the `measured_plans` row.

---

### 2. Calibrate a plan

**Requires:** An uploaded plan.

1. Select **Calibrate** tool in `PlanToolRail`
2. Click start → click end on a known distance in the plan → `calibrationDraft: LineDraft` is set
3. Enter real-world length in inspector: feet+inches mode (`calibrationFeetInput` + `calibrationInchesInput`) or decimal mode (`calibrationLengthInput`) + `calibrationUnit`
4. Click **Save Calibration** → `useSetPlanCalibration` → `PUT /:projectId/plans/:planId/calibration`
5. Worker upserts (one calibration per plan, `ON CONFLICT measured_plan_id DO UPDATE`)
6. `pixelsPerUnit = pixelLength / realWorldLength` stored on the row
7. `calibrationStatus` flips to `'calibrated'` — unlocks Length, Rectangle, and Crop tools

---

### 3. Measure flow

**Requires:** Calibrated plan. Rectangle tool in `rectangleMode: 'measure'`.

#### Stage 1 — Save measurement

1. Draw rectangle on plan → `measurementDraft: RectDraft` is set
2. Select target item from `MeasuredAreaSelect` dropdown (proposal categories → items)
3. Click **Save Measurement** → `useCreatePlanMeasurement`
4. Creates `Measurement` row with `rectX/Y/Width/Height` (pixels), `horizontalSpanBase` + `verticalSpanBase` (mm)
5. **One measurement per item per plan** — if a prior measurement exists for the same `targetItemId`, it is deleted (and its images) before the new one is created

If no target item exists yet, users can choose **Add item from measurement** in the Plans inspector. This opens a right-side create panel, auto-creates/reuses the `Uncategorized` Proposal Category, creates the item with optional field defaults, saves the Measurement, and immediately writes a Plan Image using the measured area.

This links the rectangle to the item on the plan. The proposal item is **not updated yet**.

#### Stage 2a — Crop plan image (optional)

1. With measurement selected, click **Crop plan image** → switches to Crop tool
2. Draw crop rectangle → `cropDraft: RectDraft`
3. Click **Save crop to item** → `useUpdatePlanMeasurement` writes `cropX/Y/Width/Height` (normalized fractions)
4. `savePlanImageForMeasurement()` runs:
   - Downloads raw plan blob via `api.plans.downloadContent()`
   - `measurementCropToPixelCrop()` converts normalized fractions → pixel coords using `planNaturalSize`
   - `createHighlightedPlanCrop()` draws crop region + bright yellow measurement rect overlay (solid stroke, no dashed border) → PNG blob
   - Deletes existing `proposal_plan` image assets for the item
   - Uploads PNG via `api.images.upload({ entityType: 'proposal_plan', entityId: targetItemId })`
   - Calls `restorePlanColumn()` to ensure the plan image column is visible in the proposal table
   - **Dual-write:** if `MeasurementItemRef.linkedFfeItemId` is set, the same PNG is also uploaded as `entity_type: 'item_plan'` for the linked FFE item

#### Stage 2b — Save + apply (single action)

Saving a measurement and writing its value to the linked item is **one step**. In the draft
panel (rectangle / `measure` mode) the user picks the target item, picks how to apply, then
clicks **Save & apply to item**. The application-mode picker defaults to the target's kind
(`proposal-area` for proposal items, `ffe-dimensions` for FF&E items).

Apply modes:

- `proposal-horizontal` → `quantity = horizontal span in ft`, `quantityUnit = 'ln ft'`
- `proposal-vertical` → `quantity = vertical span in ft`, `quantityUnit = 'ln ft'`
- `proposal-area` → `quantity = Math.round(hFt * vFt)`, `quantityUnit = 'sq ft'`
- `proposal-footprint` → writes footprint W × D fields directly (no `quantity`, no change log, not price-affecting)
- `ffe-dimensions` → writes the FF&E `dimensions` string

Flow (`handleSaveAndApplyMeasurement` → `persistMeasurement()` then `applyMeasurementValue()`):

1. `persistMeasurement()` upserts the `Measurement` row (geometry + base spans)
2. `applyMeasurementValue()` writes the chosen value to the item, computed from the **draft**
   values (not the persisted record — the derived `selectedMeasurement*` state lags one tick)
3. For proposal quantity modes, if `project.proposalStatus !== 'in_progress'`, `ChangeConfirmModal`
   prompts for change-log metadata before `executeApplyMeasurement` runs
4. `api.proposal.updateItem(...)` / `api.items.update(...)` then the matching query cache update

If the target item already has a measurement, a **Replace existing measurement?** `ConfirmDialog`
fires first; on confirm it runs persist + apply via a stored `pendingSaveAndApply` payload.

Once a measurement is selected, the inspector shows a compact summary plus two collapsed
`LayoutSection` accordions — **Measured area** (clear/remove) and **Plan image** (open crop
editor). There is no separate apply step on a selected measurement; changing the applied value
means re-drawing.

**Note:** Application mode is transient UI state — it is not stored on the `Measurement` row.

---

### 4. Highlight flow

**Requires:** Calibrated plan. Rectangle tool in `rectangleMode: 'highlight'`.

Used for unit-cost items where only a plan image is needed — no quantity update.

1. Draw rectangle on plan → `highlightRect` state set (no `Measurement` DB row created)
2. Select target item from dropdown
3. Click **Set Highlight** → switches to Crop tool
4. Draw crop rectangle
5. Click **Save Highlight** → `savePlanImageForMeasurement()` with a fabricated (in-memory) Measurement object
6. PNG uploaded as `proposal_plan` image asset for the item (same dual-write logic as Measure flow)

---

### 5. Length lines (secondary reference tool)

**Requires:** Calibrated plan.

Used for measuring walls, doorways, or other architectural features not in the proposal. Length lines are display-only — they are never applied to items.

1. Select **Length** tool
2. Draw line → `lengthLineDraft: LineDraft`
3. System auto-computes `measuredLengthBase` (mm) from pixel length ÷ `pixelsPerUnit`
4. Optionally add label
5. Click **Save Length Line** → `useCreatePlanLengthLine`
6. Displayed on canvas as a compact notation overlay (e.g. `12'-6"`)

---

## Canvas architecture

Three-column layout (`xl:grid-cols-[88px_minmax(0,1fr)_340px]`):

### `src/pages/PlanCanvasPage.tsx` — state orchestrator

Central state manager. Key state:

```ts
activeTool: PlanToolId                          // 'calibrate' | 'length' | 'rectangle' | 'crop' | 'pan'
rectangleMode: RectangleModeId                  // 'measure' | 'highlight'
calibrationDraft: LineDraft | null
calibrationFeetInput / calibrationInchesInput / calibrationLengthInput / calibrationUnit
lengthLineDraft: LineDraft | null
selectedLengthLineId: string | null
measurementDraft: RectDraft | null
cropDraft: RectDraft | null
selectedMeasurementId: string | null
selectedMeasurementTargetKey: string
measurementApplicationMode: MeasurementApplicationMode
highlightRect: { x; y; width; height; targetItem: MeasurementItemRef } | null
planNaturalSize: { width: number; height: number }
pendingMeasurementApply: { ... } | null         // triggers ChangeConfirmModal
isApplyingMeasurement / isSavingPlanImage / isSavingHighlight: boolean
```

Does not render the canvas directly — delegates to child components.

### `src/components/plans/canvas/PlanViewport.tsx` — image + pointer handling

- Fetches plan blob via `api.plans.downloadContent()` on mount; manages blob URL lifecycle
- Detects natural image dimensions → sets `planNaturalSize`
- Handles zoom, pan, rotation state
- Converts screen coords → image coords for all pointer events
- Renders all SVG overlays (calibration line, length lines, measurement rects, highlight, crop frame)

### `src/components/plans/canvas/PlanInspector.tsx` — right panel (340px)

Renders tool-specific panels based on `activeTool`:

- **Calibrate panel:** feet+inches or decimal input + unit selector + Save button
- **Length panel:** list, select, label edit, delete
- **Rectangle panel (measure mode):** `MeasuredAreaSelect` dropdown, dimension display, application mode selector, Save/Apply/Crop buttons
- **Rectangle panel (highlight mode):** target item selector, Set Highlight button
- **Crop panel:** Save crop to item button

### `src/components/plans/canvas/PlanToolRail.tsx` — left toolbar (88px)

Tool buttons grouped by `PlanToolGroupId`. Tools disabled until calibrated (except Calibrate and Pan). Rectangle tool has measure/highlight mode toggle.

### `src/components/plans/canvas/PlanOverlays.tsx`

SVG overlays: `LineOverlay` (calibration line, length lines) and `RectOverlay` (measurement rects, highlight, crop frame).

### `src/components/plans/canvas/MeasuredAreaSelect.tsx`

Dropdown for picking measurement target. Shows hierarchy: Category → Item. Builds `MeasurementItemRef` from selected item. Only shows `targetKind: 'proposal'` items.

---

## Canvas types — `src/components/plans/canvas/types.ts`

```ts
type PlanToolId = 'calibrate' | 'length' | 'rectangle' | 'crop' | 'pan';
type RectangleModeId = 'measure' | 'highlight';
type MeasurementApplicationMode =
  | 'proposal-horizontal' // horizontal span → quantity (ln ft)
  | 'proposal-vertical' // vertical span → quantity (ln ft)
  | 'proposal-area' // area → quantity (sq ft)
  | 'proposal-footprint' // W × D → footprint fields (no quantity, not price-affecting)
  | 'ffe-dimensions'; // W × D → FF&E dimensions string

type MeasurementItemRef = {
  key: string; // "proposal:{id}"
  targetKind: 'proposal';
  targetItemId: string;
  targetTagSnapshot: string; // item tag at selection time; pass as-is to API
  primaryLabel: string;
  secondaryLabel: string;
  containerLabel: string;
  containerId: string; // categoryId
  version: number;
  quantity?: number;
  quantityUnit?: string;
  linkedFfeItemId?: string | null; // if set, plan image is dual-written to FFE item
};

type MeasurementDisplay = {
  horizontal: string; // formatted in plan units
  vertical: string;
  area: string;
  dimensionsText: string;
};
```

---

## Hooks — `src/hooks/plans/usePlans.ts`

```ts
// Plan CRUD
useMeasuredPlans(projectId);
useCreateMeasuredPlan(projectId); // optimistic prepend to cache
useDeleteMeasuredPlan(projectId); // optimistic remove from cache

// Calibration (one per plan)
usePlanCalibration(projectId, planId);
useSetPlanCalibration(projectId, planId); // flips calibrationStatus on MeasuredPlan cache

// Length lines
usePlanLengthLines(projectId, planId);
useCreatePlanLengthLine(projectId, planId);
useUpdatePlanLengthLine(projectId, planId);
useDeletePlanLengthLine(projectId, planId);

// Measurements
usePlanMeasurements(projectId, planId);
useCreatePlanMeasurement(projectId, planId); // increments measurementCount on MeasuredPlan cache
useUpdatePlanMeasurement(projectId, planId);
useDeletePlanMeasurement(projectId, planId); // decrements measurementCount on MeasuredPlan cache
```

Query key family: `planKeys.forProject(projectId) = ['plans', projectId]`
Add new keys to `src/hooks/queryKeys.ts` (e.g. `calibrationKeys`, `measurementKeys`).

---

## API client — `src/lib/api/plans.ts`

| Method              | Signature                                                | Purpose                          |
| ------------------- | -------------------------------------------------------- | -------------------------------- |
| `list`              | `(projectId)`                                            | List all plans                   |
| `create`            | `(projectId, input: CreateMeasuredPlanInput)`            | Upload image or PDF-rendered PNG |
| `delete`            | `(projectId, planId)`                                    | Delete plan + R2 keys            |
| `downloadContent`   | `(projectId, planId) → Blob`                             | Fetch image/PNG for viewport     |
| `getCalibration`    | `(projectId, planId)`                                    | Load calibration or null         |
| `setCalibration`    | `(projectId, planId, input: UpdatePlanCalibrationInput)` | Upsert calibration               |
| `listLengthLines`   | `(projectId, planId)`                                    | Load reference lines             |
| `createLengthLine`  | `(projectId, planId, input: UpsertPlanLengthLineInput)`  | Add reference line               |
| `updateLengthLine`  | `(projectId, planId, lineId, input)`                     | Edit reference line              |
| `deleteLengthLine`  | `(projectId, planId, lineId)`                            | Remove reference line            |
| `listMeasurements`  | `(projectId, planId)`                                    | Load measurements                |
| `createMeasurement` | `(projectId, planId, input: UpsertPlanMeasurementInput)` | Add measurement                  |
| `updateMeasurement` | `(projectId, planId, measurementId, input)`              | Edit measurement                 |
| `deleteMeasurement` | `(projectId, planId, measurementId)`                     | Remove measurement               |

**Key input types:**

```ts
type CreateMeasuredPlanInput = {
  name: string;
  sheetReference?: string;
  file: File;
  sourcePdfFile?: File;
  pdfPageNumber?: number;
  pdfPageWidthPt?: number;
  pdfPageHeightPt?: number;
  pdfRenderScale?: number;
  pdfRenderedWidthPx?: number;
  pdfRenderedHeightPx?: number;
  pdfRotation?: number;
};
type UpdatePlanCalibrationInput = {
  startX;
  startY;
  endX;
  endY;
  realWorldLength;
  unit;
  pixelsPerUnit;
};
type UpsertPlanLengthLineInput = { startX; startY; endX; endY; measuredLengthBase; label };
type UpsertPlanMeasurementInput = {
  targetKind;
  targetItemId;
  targetTagSnapshot;
  rectX;
  rectY;
  rectWidth;
  rectHeight; // pixels
  horizontalSpanBase;
  verticalSpanBase; // mm
  cropX?;
  cropY?;
  cropWidth?;
  cropHeight?; // 0–1 fractions, nullable
};
```

---

## Worker API — `api/src/routes/plans.ts`

Every handler follows this order:

1. `assertProjectOwnership(c.env, projectId, uid)` → catch → 404
2. `SomeSchema.safeParse(body)` → `.success === false` → 400
3. R2 key convention: `users/${uid}/projects/${projectId}/plans/${planId}.${ext}`
4. SQL insert; if it throws: `IMAGES_BUCKET.delete(r2Key)` rollback
5. Return `c.json({ plan: row }, 201)`

`calibrationStatus` and `measurementCount` are computed via SQL `LEFT JOIN` / `COUNT` — never `UPDATE` them directly. Calibration uses `ON CONFLICT measured_plan_id DO UPDATE` (one calibration per plan).

---

## Utility functions — `src/lib/plans/`

Barrel at `src/lib/plans/index.ts` re-exports all three modules.

### `geometry.ts`

```ts
type ImagePoint = { x, y }        // canvas-relative coords
type LineDraft = { startX, startY, endX, endY }
type RectDraft = { startX, startY, endX, endY }
type RectBounds = { x, y, width, height }

normalizeRectDraft(rect) → RectBounds   // startX/endX → x/width
measurementToRectBounds(rect) → RectBounds
buildRectPolygonPoints(rect) → ImagePoint[]
getLineLength(line) → number            // Euclidean distance
clampPointToRect(point, rect) → ImagePoint
pointInRect(point, rect) → boolean
```

### `formatting.ts`

Canonical unit is **millimeters**. All `*SpanBase` and `measuredLengthBase` fields are stored in mm.

```ts
convertPlanUnitsToBase(value, unit) → mm
convertBaseToPlanUnits(mm, unit) → value_in_unit
parseFeetAndInches(feetInput, inchesInput) → decimalFeet
formatPlanLength(value, unit) → "12'-6½"" | "3.8 m"
formatPlanLengthCompact(value, unit) → tight HUD notation
formatAreaUnit(unit) → "sq ft" | "sq in" | "sq m" | ...
formatDisplayNumber(value) → adaptive precision string
```

### `pdf.ts`

```ts
renderPdfThumbnails(file, scale = 0.2, maxPages = 80) → Promise<PdfPagePreview[]>
renderPdfPageAsPngFile({ file, pageNumber, filename, scale = 2 }) → Promise<RenderedPdfPage>
```

Both use lazy-loaded `pdfjs-dist`. Import directly: `import { ... } from '../lib/plans/pdf'` (not re-exported from barrel).

---

## PDF support

When `sourceType === 'pdf-page'`:

- Canvas reads `pdfRenderedWidthPx` × `pdfRenderedHeightPx` for natural dimensions
- `downloadContent` returns the rendered PNG (not the original PDF)
- Original PDF is stored separately in R2 for re-rendering if needed

When `sourceType === 'image'`:

- Canvas reads natural image dimensions from the loaded image element
- `downloadContent` returns the image file directly

---

## Protected R2 image loading

All R2 assets are auth-gated:

```text
apiFetchResponse(path)          // adds Authorization: Bearer <token>
  → Worker assertProjectOwnership
  → R2 stream
  → response.blob()
  → URL.createObjectURL(blob)   // revoke on cleanup
```

Client: `api.plans.downloadContent(projectId, planId)` → `GET /api/v1/projects/:id/plans/:planId/content`

For blobs: `apiFetchResponse(...).then(r => r.blob())`. (`apiFetch` returns parsed JSON; `apiFetchResponse` returns raw `Response`.)

---

## Blob URL lifecycle pattern

```ts
useEffect(() => {
  let disposed = false;
  let objectUrl: string | null = null;
  async function load() {
    const blob = await api.plans.downloadContent(projectId, plan.id);
    if (disposed) return;
    objectUrl = URL.createObjectURL(blob);
    setPreviewUrl(objectUrl);
  }
  void load();
  return () => {
    disposed = true;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}, [plan.id, projectId]);
```

---

## PlansPage — `src/pages/PlansPage.tsx`

- Header with plan count badge and calibration status badge
- Filter by calibration status: `'all' | 'calibrated' | 'uncalibrated'`
- Sort by: `'added' | 'name' | 'measurement count'`
- Responsive card grid (`md:grid-cols-2 2xl:grid-cols-3`) — `MeasuredPlanCard` per plan
- `PlanUploadModal` for creating new plans
- Delete guard: `window.confirm` with measurement count warning

`MeasuredPlanCard` loads preview via blob URL lifecycle pattern; shows calibration badge and source label (PDF page number or image file size). Links to `/projects/${projectId}/plans/${plan.id}`.

---

## Image type note

`ImageEntityType` does **not** include `'plan'`. Plan images stored in R2 via `image_r2_key` are separate from `ImageAsset` rows. Do not use `ImageFrame` or `useImages` for plan content. Plan images saved from the canvas use `entity_type: 'proposal_plan'` (or `'item_plan'` for linked FFE items).

---

## Key primitives — `src/components/primitives/`

| Component        | Notes                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `Drawer`         | Right-side slide-in, focus-trapped, Esc-closeable                  |
| `Modal`          | `<dialog>` native, backdrop-click dismiss                          |
| `Button`         | `variant: 'default' \| 'ghost' \| 'outline'`, `size: 'sm' \| 'md'` |
| `InlineTextEdit` | Click-to-edit text field                                           |

---

## v1 Plans constraints

These implementation-scope rules were moved here from CONTEXT.md to keep the always-read domain doc lean. They apply to the current v1 Plans workspace.

- In v1, calibrated Measured Plans and saved Measurements are immediately usable; there is no separate publish/finalize workflow.
- In v1, a **Measured Plan** image is not replaced in place. Users create a new Measured Plan instead.
- In v1, **Measured Plan** uploads accept image files and selected PDF pages. PDF uploads are rendered to stable page images for calibration, measurement, and crop publishing; the app does not parse PDF text or vector geometry.
- In v1, item surfaces can show a lightweight indicator that a Measurement or Plan Image exists, but measurement editing remains inside **Plans**. The indicator deep-links into **Plans** with the relevant **Measured Plan** and **Measurement** selected.
- In v1, an opened **Measured Plan** supports non-destructive display rotation.
- In v1, zoom and pan in the Plans workspace are session-local UI state and do not persist when reopening a plan.
- In v1, **Measurements** keep only current authoritative state; there is no revision history.
- In v1, **Length Lines** are saved current-state records on a Measured Plan, individually deletable, with no history.
