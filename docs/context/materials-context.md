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
  - material assigned with finish: prompt overwrite or discard before any upload
- In FF&E Catalog Editor, the `Add swatch` control in Media supports the same
  paste routing behavior for the active catalog item.
- Use the Materials tab to view and manage all library entries for the project.
- In the Materials toolbar, the left slot shows:
  - an Options dropdown with View toggle plus:
    - `Import from Excel` opens a tab-specific 3-step modal:
      - Finish Library tab: finish import modal
      - Project Materials tab: materials import modal
    - `Export` opens a tab-aware format menu (CSV, Excel, PDF) and exports the
      current filtered rows in table format:
      - Finish Library tab: filtered finishes
      - Project Materials tab: filtered materials
    - `Delete All` opens a destructive confirmation that includes an exact row
      count for the active tab and deletes through existing per-item hooks
      (no bulk endpoint)
  - a segmented tab switcher for Finish Library and Project Materials
  - category filter select (Finishes tab only)
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
- The Project Materials import modal consumes the materials parser through the
  same 3-step flow and creates project material rows:
  - resolves the mapped Finish column against project finishes by
    case-insensitive name first, then code
  - unresolved finishes are non-fatal: the material is created with `finishId=null`
    and a row warning is added to the summary
- Import warning semantics:
  - row-level finish create failures are non-fatal and reported in the summary
  - swatch image upload failures are non-fatal and reported per row in the summary
  - row-level material create failures are non-fatal and reported in the summary
