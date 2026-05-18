# Frontend Design System Update Prompt

## Role

You are a senior product designer and frontend engineer. Your task is to update the global style system for this app so it feels cleaner, sharper, more professional, and more appropriate for architecture / interior-design project workflows.

Treat this as a **design-system pass first** and a **page-polish pass second**.

The goal is not to redesign the whole app from scratch. The goal is to make the existing product feel cohesive, high-trust, polished, and intentional while preserving the current workflows.

---

## Product context

This app is a project management, FF&E, proposal, plans, materials, and budget tool for architecture / interior-design workflows.

Main areas include:

- Dashboard / project list
- Project settings and project images
- FF&E table
- FF&E catalog / spec-sheet view
- Proposal table
- Plans library
- Plan measurement / calibration canvas
- Materials / finish library
- Budget dashboard

Screenshots of the current UI have been provided. Use them to understand current layout, density, interaction patterns, visual inconsistencies, and page-specific needs.

---

## Design direction

Update the UI so it feels:

- Clean
- Professional
- Sharp
- Calm
- Architecture / interior-design themed
- High trust
- Editorial, but still highly usable
- Unique, not generic SaaS
- Not obviously AI-generated
- Consistent across all pages

Use a restrained visual language inspired by:

- Architectural drawing sets
- Interior-design presentation boards
- Material schedules
- Professional studio tools
- Clean specification documents
- Premium but practical project-management software

Avoid:

- Generic Tailwind dashboard styling
- Random gradients
- Neon colors
- Excessive shadows
- Overly rounded bubble UI
- Decorative or fancy fonts
- Page-by-page one-off styling
- Changing business logic, data flow, routes, APIs, or backend behavior

---

## Current visual problems to solve

The current UI is functional, but it needs stronger polish and consistency.

Visible issues from the screenshots and style audit:

- The palette feels too soft / washed out in places.
- The warm beige background is useful, but some pages feel dull instead of crisp.
- Colors need sharper contrast and better semantic structure.
- Typography needs to feel more architectural and consistent.
- Tables need stronger hierarchy, hover states, selected states, headers, and totals.
- Buttons, tabs, badges, pills, inputs, cards, toolbars, icon buttons, and inspector panels should look like one shared system.
- Some pages feel overly empty or centered without enough supporting structure.
- The FF&E catalog page is promising, but should feel more like a refined spec sheet / tear sheet.
- The plan canvas should feel like a professional drawing-review tool, not a separate visual system.
- The budget dashboard should feel more executive-ready and less placeholder-like.

---

## Important audit findings to use

Use the style audit as a guide so you do not need to rediscover everything manually.

### High-impact shared primitives

The audit identified these as high-leverage shared UI surfaces:

- `src/components/primitives/Button.tsx`
- `src/components/primitives/Modal.tsx`
- `src/components/primitives/Drawer.tsx`
- `src/components/primitives/InlineTextEdit.tsx`
- `src/components/primitives/InlineNumberEdit.tsx`
- `src/components/primitives/StatusBadge.tsx`
- `src/components/shared/table/TableViewWrappers.tsx`
- `src/components/shared/BulkActionBar.tsx`
- `src/components/shared/TotalsBar.tsx`
- `src/components/shared/ColumnVisibilityPopover.tsx`

Start by inspecting these before making broad page-level changes.

### Highest priority consistency issue

The audit found a mixed use of Tailwind `gray-*` classes and project `neutral-*` tokens. The project already has custom neutral tokens, while `gray-*` is not part of the project token system.

Use `neutral-*` for semantic grays wherever appropriate.

Hotspots include:

- `src/components/materials/MaterialsView.tsx`
- `src/components/materials/MaterialLibraryModal.tsx`
- `src/components/ffe/items/FfeTable.tsx`
- `src/components/ffe/summary/SummaryView.tsx`
- `src/components/proposal/ChangeConfirmModal.tsx`
- `src/components/shared/auth/AuthGate.tsx`
- `src/App.tsx`
- `src/components/shared/table/TableViewWrappers.tsx`

Suggested mapping:

| Existing   | Preferred     |
| ---------- | ------------- |
| `gray-50`  | `neutral-50`  |
| `gray-100` | `neutral-100` |
| `gray-200` | `neutral-200` |
| `gray-300` | `neutral-300` |
| `gray-400` | `neutral-400` |
| `gray-500` | `neutral-500` |
| `gray-600` | `neutral-600` |
| `gray-700` | `neutral-700` |
| `gray-800` | `neutral-800` |
| `gray-900` | `neutral-900` |
| `gray-950` | `neutral-950` |

Exception: if a `gray-*` class is being used as a distinct inset surface, consider replacing it with an existing semantic token like `bg-surface-muted` instead of doing a blind one-to-one replacement.

Do not blindly replace classes without checking context.

### Duplicated class patterns to extract

The audit found several repeated inline class strings. Prefer extracting these into `@layer components` utilities or existing shared primitives.

Recommended additions in `src/index.css`:

```css
@layer components {
  .input-base {
    @apply w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal text-neutral-950 focus:border-brand-500 focus:outline-none;
  }

  .icon-btn {
    @apply inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500;
  }

  .focus-ring {
    @apply focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500;
  }
}
```

You may adjust the exact utility names or implementation if the codebase already has a better primitive pattern. The important goal is to reduce repeated one-off class strings and make the visual system easier to maintain.

Apply the input utility or equivalent shared primitive to repeated form inputs in:

- `src/components/materials/MaterialsView.tsx`
- `src/components/materials/MaterialLibraryModal.tsx`
- `src/components/ffe/items/AddItemDrawer.tsx`
- `src/components/project/modals/EditProjectModal.tsx`
- `src/components/project/modals/NewProjectModal.tsx`
- `src/components/ffe/catalog/CatalogView.tsx`
- `src/components/shared/auth/AuthGate.tsx`

Also consider extracting / standardizing:

- menu popup panel styles used in `FfeTable.tsx`
- icon button styles used in `FfeTable.tsx`
- table header label styles used across table variants

### Focus ring consistency

The audit found multiple focus styles:

- `focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500`
- `focus:border-brand-500 focus:outline-none`
- `focus:ring-2 focus:ring-brand-400`

Standardize focus behavior so keyboard and form interactions are consistent and accessible.

For form inputs, prefer a clean border-color focus state unless the existing primitive pattern suggests otherwise.

For buttons / interactive controls, preserve visible keyboard focus.

### Plan canvas tokenization

The plan canvas currently has hardcoded colors that should become tokens or centralized constants.

Recommended tokens:

```css
:root {
  --color-canvas-bg: 227 222 210;
  --color-canvas-shell: 243 241 234;
  --color-canvas-chrome: 251 250 246;
  --color-plan-line: 139 111 71;
  --color-plan-measure: 193 122 0;
  --color-plan-active: 5 150 105;
}
```

Register these in `tailwind.config.ts` if that matches the existing token pattern.

Use these to replace hardcoded plan/canvas colors in:

- `src/pages/PlanCanvasPage.tsx`
- `src/components/plans/canvas/PlanViewport.tsx`
- `src/components/plans/canvas/PlanInspector.tsx`
- `src/components/plans/canvas/PlanToolRail.tsx`
- `src/components/plans/canvas/PlanOverlays.tsx` if relevant

The exact color values can be adjusted slightly if needed to achieve better contrast and polish. Keep the plan tool calm, professional, and drawing-board inspired.

### Border radius consistency

The audit found inconsistent input radii:

- `rounded-md` in most of the app
- `rounded-lg` in plan upload areas
- `rounded-2xl` in `PlanInspector.tsx`

Standardize inputs and selects so they feel related. Avoid overly pill-shaped inputs unless there is a clear reason.

For the plan canvas inspector, prefer `rounded-lg` or the shared input style unless a better local pattern already exists.

### Dynamic styling hotspots

Be careful in files with dynamic class composition. Do not rely only on static search or bulk replacement.

Manual review required:

- `src/components/ffe/items/FfeTable.tsx`
- `src/components/shared/ColumnVisibilityPopover.tsx`
- `src/components/shared/BulkActionBar.tsx`
- `src/components/project/ProjectHeader.tsx`
- `src/pages/DashboardPage.tsx`
- `src/components/materials/MaterialsView.tsx`
- `src/components/ffe/catalog/CatalogView.tsx`

Search specifically for:

- `cn(`
- `clsx(`
- `className={[`
- template literals inside `className`
- conditional active / selected / disabled classes

---

## Suggested implementation sequence

Use this sequence unless you discover a clearly better path after inspecting the codebase.

### 1. Inspect styling architecture

Before editing, inspect:

- `src/index.css`
- `tailwind.config.ts`
- existing primitive components
- table wrapper components
- project/page shell components
- any existing `cn` utility or class helper
- current font imports / theme setup

Identify the smallest set of global token and primitive updates that will improve the whole app.

### 2. Update global design tokens

Refine the existing design tokens for:

- Backgrounds
- Surfaces
- Muted surfaces
- Text colors
- Border colors
- Brand / accent colors
- Status colors
- Focus colors
- Shadows
- Radii
- Typography

Do not create excessive tokens. Prefer a small, practical system that is easy to apply.

### 3. Add or refine shared component classes / primitives

Add shared utilities or component abstractions for repeated styles:

- Input base
- Icon button
- Focus ring
- Menu popup panel
- Table header label
- Small metadata label / eyebrow
- Status badge / pill refinements if needed

Prefer improving existing primitives over creating duplicate abstractions.

### 4. Normalize `gray-*` to the project neutral system

Replace default `gray-*` classes with `neutral-*` or semantic surface tokens where appropriate.

Do this carefully in dynamic class areas.

### 5. Polish shared primitives

Improve the look and consistency of:

- Button
- IconButton / icon button utility
- Modal
- Drawer
- InlineTextEdit
- InlineNumberEdit
- StatusBadge
- TableViewWrappers
- BulkActionBar
- TotalsBar
- ColumnVisibilityPopover
- ImageFrame if relevant

The goal is for most pages to improve automatically through shared pieces.

### 6. Apply targeted page-specific polish

After shared improvements, make smaller local adjustments only where needed.

Focus on:

- Dashboard
- Project settings / images page
- FF&E table
- FF&E catalog view
- Proposal table
- Plans library
- Plan canvas
- Budget dashboard
- Materials / Finish Library

Avoid heavy one-off styling.

### 7. Verify

Run the available project checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If one of these commands is not available or fails due to pre-existing issues, document that clearly.

Also visually spot-check:

- Dashboard
- Project settings / images
- FF&E table
- FF&E catalog view
- Proposal table
- Materials / Finish Library
- Add Item drawer
- Plans library
- Plan canvas
- Budget dashboard
- Mobile/card table view if supported

---

## Page-specific goals

### Dashboard

Make the dashboard feel like a professional studio workspace.

Improve:

- Project list cards
- Company/project grouping
- Preview image treatment
- Spacing and hierarchy
- Sort controls
- “New Project” action

The page should feel welcoming, but still refined and work-focused.

### Project settings / project images

Make project image management feel intentional and polished.

Improve:

- Image cards
- Preview selection state
- Remove actions
- Project information layout
- Section dividers
- Metadata styling

### FF&E table

Make the FF&E table feel like a clean specification schedule.

Improve:

- Column hierarchy
- Row spacing
- Header styling
- Material swatches
- Status pills
- Totals
- Room/category group headers
- Hover and selected states
- Image thumbnails
- Action menus

Maintain dense data readability. Do not make rows overly tall.

### FF&E catalog view

Make the catalog page feel like a premium item tear sheet / spec sheet.

Improve:

- Catalog page framing
- Item navigation controls
- Image area
- Product specs section
- Finish schedule
- Price/quantity table
- Notes/location areas
- Typography and spacing

Do not redesign it into something completely different. Refine what exists.

### Proposal table

Make the proposal table visually consistent with the FF&E table while respecting proposal-specific columns and workflow.

Improve:

- Category headers
- Table density
- Editable fields
- Totals
- Status control
- Import/export/add-category toolbar
- Image/plan thumbnail treatment

### Plans library

Make the plans library feel like a document-management area for drawing sheets.

Improve:

- Plan cards
- Upload panel
- Calibration badge
- Metadata
- Empty/selected states
- File upload dropzone

### Plan measurement / calibration tool

Make this page feel like a professional drawing review/editor tool.

Improve:

- Left tool rail
- Canvas area
- Top sheet header
- Zoom controls
- Inspector panel
- Calibration controls
- Saved scale display
- Active tool states
- Contrast between drawing canvas and surrounding UI

Preserve the measurement workflow and existing tools.

### Materials / Finish Library

Use the neutral/token system and shared form/input patterns so the materials area feels connected to FF&E and Proposal workflows.

Improve:

- Library modal polish
- Form input consistency
- Material cards/rows
- Swatch presentation
- Metadata hierarchy
- Search/filter controls if present

### Budget page

Make budget reporting feel clearer and more executive-ready.

Improve:

- Summary cards
- FF&E / Proposal comparison
- Category tables
- Totals
- Status chips
- Export controls

---

## Files to avoid during this pass

Do not touch these unless absolutely necessary:

- `src/lib/export/ffe/catalogPdf.ts`
  - PDF rendering colors / RGB values are intentional and separate from browser UI styling.
- `src/data/sampleProject.ts`
- `src/data/catalogFixture.ts`
  - Hex values here are material swatch data, not UI styling.
- `api/**`
  - Backend is out of scope.
- `src/test/**`
- `*.test.tsx`
  - Do not modify tests unless a legitimate test update is required by an intentional UI change.

---

## Constraints

- Do not change business logic.
- Do not change API behavior.
- Do not change database logic.
- Do not rename routes.
- Do not break imports.
- Do not remove existing features.
- Do not delete classes merely because a static audit says they might be unused.
- Do not make broad visual changes that only work on one screenshot.
- Do not introduce large dependencies unless clearly justified.
- Preserve accessibility:
  - Strong contrast
  - Visible focus states
  - Usable target sizes
  - Clear active/disabled states
  - Keyboard navigability
- Desktop polish is the priority for this pass, but do not knowingly break responsive views.

---

## Expected outcome

The final UI should feel like one cohesive professional design studio tool.

It should have:

- Stronger contrast
- More intentional typography
- More consistent tables
- More polished cards, buttons, inputs, tabs, badges, toolbars, and panels
- A better architectural / studio identity
- Less scattered one-off styling
- A clearer token and primitive system
- Improved maintainability for future UI work
- No loss of functionality

---

## Deliverables

When finished, provide:

1. Summary of the design direction implemented.
2. List of changed design tokens / shared utilities / primitives.
3. List of page-specific polish changes.
4. Any files intentionally not touched.
5. Verification commands run and results.
6. Any remaining recommended follow-up passes.
