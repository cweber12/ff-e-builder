# Materials Context

FF&E Builder stores reusable materials per project. A material can be assigned to
multiple items, and each item can have multiple materials.

## Scope and maintenance

- This is a deep context doc for the Finish Library/Materials subsystem.
- Update it when Materials behavior or interface contracts change.
- Skip updates for refactors that do not change behavior/contracts.

## Data Model

- `materials` stores project-scoped library entries with name, material ID, and
  description. Legacy color fields remain for backward-compatible API payloads,
  but the UI treats the uploaded material image as the swatch.
- `material_swatches` is retained for backward-compatible reads of older
  material records.
- `item_materials` stores the many-to-many relationship between items and
  materials.
- Material images use the shared `image_assets` table and private R2 image flow
  with `entity_type=material`.

## UI Flow

- Open an item's material editor from the Materials cell in the table.
- Paste an image directly into an FF&E or Proposal Materials cell to route by
  current cell state:
  - no material assigned: create a new finish, create+assign a material, and
    upload the image to that finish
  - material assigned without finish: create a new finish, attach it, and upload
    the image
  - material assigned with finish:
    - prompt overwrite or discard before any upload
    - successful overwrite shows a 10-second Undo action
    - Undo restores the previous primary swatch when possible, otherwise
      surface non-blocking failure feedback
- In FF&E Catalog Editor, the `Add swatch` control in Media supports the same
  paste routing behavior for the active catalog item.
- Use the Materials tab to view and manage project materials as the primary
  surface.
- On desktop, a header `Open finishes` / `Close finishes` toggle docks a
  full-height Finishes panel directly beside the project tool rail with no gap,
  visually extending the rail.
- On mobile and narrow tablet widths, the same Finishes panel opens as an
  overlay instead of a docked rail extension.
- The Materials toolbar keeps material-only controls:
  - a `Grid / Table` view toggle
  - a material options menu for `New material`, `Import from Excel`, `Export`,
    and `Delete all`
  - material search
- Finish-specific actions no longer live in the main Materials controls. They
  live only inside the Finishes panel.
- The Finishes panel top stack is ordered:
  - `FINISHES` header with filtered count
  - category filter select
  - search field
  - `New finish`
- The Finishes panel header also includes a finish-only options menu for:
  - `Import from Excel`
  - `Export`
  - `Delete all finishes`
- The Finishes panel replaces the old Finish Library grid/table page views with
  a single compact list styled like the FF&E list.
- Each finish row shows a fixed thumbnail, code, source link, name,
  sub-category, and `Edit` action. Delete moves into the finish editor footer.
- On desktop, users can drag a finish row from the Finishes panel onto either a
  material grid card or a material table row to assign that finish immediately.
- On mobile, the Finishes panel is browse/edit only in the first pass; drag
  assignment remains desktop-only.
- Add materials while creating an item from the Add Item drawer. The drawer can
  select existing material names and can open the same material library form used
  by the table and Materials tab.
- Assign existing library entries or add a new material and assign it in one
  step.
- Edit material name, ID, and description from the library view.
- Upload a material swatch image from the add/edit material form or material card.
- Catalog pages display assigned material swatch images and names.

Deleting a material removes it from the project library and from any items that
used it.

Deleting all finishes does not delete project materials; existing material-finish
relationships may need relinking.

## Import parser surface

- The import library exposes finish/material parser helpers for upcoming Materials
  import UI wiring:
  - `parseFinishSpreadsheet(file)` and `autoMapFinishColumns(columns)`
  - `parseMaterialSpreadsheet(file)` and `autoMapMaterialColumns(columns)`
- Auto-mapping uses synonym groups (for example, `Mfr` to manufacturer, `Part #`
  to material ID, `Base Finish` to finish).
- Files without a recognizable header row (fewer than three header labels)
  return a parse warning.
- The Finishes import modal consumes the finish parser through a 3-step flow:
  - upload (`.xlsx`, `.xls`, `.csv` only; unsupported file types are rejected)
  - confirm (filename, row count, detected columns, recognized field mappings, parse warnings)
  - import (row-by-row finish creation, optional swatch image upload, progress, and warning summary)
  - on project-scoped exact normalized finish-name collision (trim + case-insensitive), import
    does not create a duplicate finish:
    - no row image: uses existing finish and reports the row decision in summary warnings
    - row image present: overwrites existing finish swatch image only and reports the row decision
- The Project Materials import modal consumes the materials parser through the
  same 3-step flow and creates project material rows:
  - resolves the mapped Finish column against project finishes by
    exact normalized name first (trim + case-insensitive), then code
  - unresolved finishes are non-fatal: the material is created with `finishId=null`
    and a row warning is added to the summary
- Import warning semantics:
  - row-level finish create failures are non-fatal and reported in the summary
  - swatch image upload failures are non-fatal and reported per row in the summary
  - row-level material create failures are non-fatal and reported in the summary
