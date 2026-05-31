# Generated Item Table State

This document records where the FF&E and Proposal table consolidation currently stands. It is a handoff note for future implementation slices, not a new architecture decision.

## Product Direction

FF&E and Proposal are different views of shared **Generated Item** data.

- FF&E groups Generated Items by **Location**.
- Proposal groups Generated Items by **Proposal Category**.
- Proposal Items designated for FF&E should have consistent shared item data in both views.
- Proposal remains the owner of pricing, Revision Round cost resolution, and detailed revision workflow for now.
- FF&E can show revision indicators and notes for linked Generated Items, but FF&E does not need its own revision sticky columns or price-resolution UI at this stage.

The immediate goal is reliable shared data for Proposal Items that are used to generate FF&E Catalog output.

## Current Data Behavior

The existing `items` table is the canonical Generated Item storage target. Proposal compatibility rows still exist in `proposal_items` while route contracts continue to support legacy Proposal APIs.

Implemented behavior:

- FF&E-created Generated Items are mirrored into Proposal under the default **Furniture** Proposal Category.
- Proposal-created Furniture items are FF&E-visible by default.
- Non-Furniture Proposal Items stay Proposal-only until the user chooses **Add to FF&E**.
- **Add to FF&E** marks the linked Generated Item as FF&E-visible and places it in the FF&E Location matching the Proposal Item `location` field, or **Unassigned** if blank.
- Removing an item or Location from FF&E clears FF&E visibility. It does not delete the Generated Item, Proposal row, images, materials, revisions, or database records.
- Linked Rendering and Plan Images are read through the Generated Item link so FF&E and Proposal can show the same item images.
- Linked Finish Library materials are exposed in both views through shared material cell helpers.

Important bridge files:

- `api/src/lib/generatedItems.ts` contains the Worker read/write bridge between `items`, `proposal_items`, visibility, default groups, mirroring, and revision effects.
- `src/lib/api/items.ts` and Proposal API clients keep route-level compatibility for the React app.
- `src/components/ffe/list/FfeItemList.tsx` and `src/components/proposal/table/ProposalTable.tsx` are separate FF&E/Proposal surfaces, with shared Generated Item cell and style modules primarily used by Proposal.

## Shared Field Expectations

These fields should remain consistent for linked FF&E-visible Proposal Items:

| User-facing field   | Canonical storage / behavior                                                              |
| ------------------- | ----------------------------------------------------------------------------------------- |
| ID                  | `item_id_tag` / `product_tag` display as the item identifier                              |
| Name                | Proposal `item_name` maps to FF&E `item_name`; do not infer Name from Product Description |
| Product Description | Stored separately from Name as `description`                                              |
| Quantity            | Shared quantity value; displayed as Quantity in both views                                |
| Unit Cost           | Shared integer cents value                                                                |
| Location            | Proposal `location` chooses or creates the FF&E Location when added to FF&E               |
| Size                | Proposal size fields map to FF&E Size/Dimensions presentation where currently supported   |
| Drawings            | Shared text field                                                                         |
| Rendering           | Shared linked image surface                                                               |
| Plan Image          | Shared linked item-level Plan Image surface                                               |
| Swatch              | Shared Finish Library assignments/material visuals                                        |

## Current Shared Table Functionality

The following table behavior has already been consolidated into shared modules:

- Generated Item table view presets: `src/lib/table/generatedItemTablePresets.ts`
- Generated Item change metadata: `src/lib/table/generatedItemChangeFields.ts`
- Generated Item change extraction: `src/lib/table/generatedItemChangeInfo.ts`
- Shared text edit controls: `src/components/shared/table/GeneratedItemEditableTextCell.tsx`
- Shared number, money, and quantity edit controls: `src/components/shared/table/GeneratedItemEditableNumberCell.tsx`
- Shared Rendering and Plan image cells: `src/components/shared/table/GeneratedItemImageCell.tsx`
- Shared Finish Library material cells/badges: `src/components/shared/table/GeneratedItemMaterialsCell.tsx`
- Shared size trigger and modal: `src/components/shared/table/GeneratedItemSizeModal.tsx`
- Shared row drag handle: `src/components/shared/table/GeneratedItemDragHandle.tsx`
- Shared row action trigger: `src/components/shared/table/GeneratedItemActionControls.tsx`
- Shared grouped table wrappers and mobile field chrome: `src/components/shared/table/TableViewWrappers.tsx`
- Shared sticky style helpers for regular FF&E/Proposal edge/value columns: `src/components/shared/table/generatedItemStickyStyles.ts`
- Shared Proposal revision indicator UI used by FF&E: `src/components/proposal/revision`

Proposal still owns full table composition, data hooks, row actions, grouped layout, and sticky revision table structure.

## Intentional Deferrals

These are not priority cleanup targets for the current round:

- Building FF&E revision sticky columns.
- Letting users resolve Proposal revision prices from FF&E.
- Fully replacing Proposal's open-revision sticky block.
- Removing `proposal_items` compatibility storage.
- Moving files into a new `src/modules` structure.
- Rewriting exports to a shared Generated Item export document.

These may still be valid future work, but they should happen only after shared item data consistency is stable.

## Known Limitations

- `proposal_items` remains writable compatibility storage.
- Some Proposal revision table layout is still Proposal-specific and intentionally complex.
- FF&E table editing has been retired; Proposal remains the editable table surface for pricing and revision workflows.
- Generated Item exports are not fully unified yet; FF&E Catalog generation should be the next export-oriented target once table data consistency is confirmed.
- Some legacy test warnings unrelated to table data may still appear, such as React Router future flag warnings and Plan test `act(...)` warnings.

## Suggested Future Slices

1. **Shared data consistency audit**
   - Verify Add to FF&E and Furniture defaulting for imported and manually added Proposal Items.
   - Confirm ID, Name, Product Description, Quantity, Unit Cost, Rendering, Plan Image, Location, Size, and Swatch stay consistent in both views.
   - Add targeted tests around those field mappings.

2. **FF&E Catalog from Generated Items**
   - Ensure FF&E Catalog reads linked Proposal-origin Generated Items with correct Name, Product Description, images, materials, and size fields.
   - Do not start with PDF/Excel/CSV unification unless catalog output is blocked.

3. **Table composition cleanup**
   - Continue extracting shared row/cell layout only where FF&E and Proposal already behave the same.
   - Keep Proposal revision-specific layout inside Proposal until it becomes a real shared need.

4. **Export unification**
   - Later, introduce a shared Generated Item export document consumed by CSV, Excel, PDF, and Catalog renderers.
   - Preserve existing public export function names until callers are migrated.

5. **Retire compatibility storage**
   - Only after new imports and manually added data work reliably through Generated Items, remove or archive remaining `proposal_items` write paths.

## Verification Focus

For future slices, prioritize these checks:

- Imported Proposal Furniture item appears in FF&E.
- Proposal item added with **Add to FF&E** appears in the Location matching Proposal Location, or Unassigned when blank.
- Proposal Name appears as FF&E Name.
- Product Description remains separate from Name.
- Rendering and Plan Image display consistently in both tables.
- Removing from FF&E leaves the Proposal item intact.
- Proposal remains the place for revision cost resolution.
