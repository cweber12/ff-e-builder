# Materials

FF&E Builder stores reusable materials per project. A material can be assigned to
multiple items, and each item can have multiple materials.

## Data Model

- `materials` stores project-scoped library entries with name, material ID,
  description, and a primary `swatch_hex`.
- `material_swatches` stores ordered supplemental swatches for multi-finish
  materials. The first swatch remains mirrored to `materials.swatch_hex` for
  backward-compatible display and exports.
- `item_materials` stores the many-to-many relationship between items and
  materials.
- Material images use the shared `image_assets` table and private R2 image flow
  with `entity_type=material`.

## UI Flow

- Open an item's material editor from the Materials cell in the table.
- Add materials while creating an item from the Add Item drawer; existing
  material names are reused, and new names are added to the project library and
  assigned after the item is created.
- Assign existing library entries or add a new material and assign it in one
  step.
- Edit material name, ID, description, and one or more swatches from the library
  view.
- Upload a material image from the material card.
- Catalog pages display assigned material swatches and names.

Deleting a material removes it from the project library and from any items that
used it.
