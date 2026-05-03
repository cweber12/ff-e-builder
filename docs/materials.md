# Materials

FF&E Builder stores reusable materials per project. A material can be assigned to
multiple items, and each item can have multiple materials.

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
- Use the Materials tab to view and manage all library entries for the project.
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
