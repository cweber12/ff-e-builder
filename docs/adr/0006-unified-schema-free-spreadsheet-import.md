# ADR-0006: Unified Schema-Free Spreadsheet Import

| Field    | Value      |
| -------- | ---------- |
| Date     | 2026-05-09 |
| Status   | Accepted   |
| Deciders | @cweber12  |

---

## Context

The FF&E and Proposal spreadsheet import features had separate parsers (`ffe.ts`, `proposal.ts`) and a shared detection engine (`engine.ts`). Users reported three classes of failure:

1. **Wrong header detection** — the scoring algorithm picked metadata/title rows over the real column header row, causing cell data to appear as column headers and column headers to appear as table titles.
2. **Data truncation** — `extractTableRows` stopped at the first empty row, silently dropping data in spreadsheets with blank formatting rows.
3. **Phantom duplicates** — the ID-anchored multi-row merging (`groupRowsById`) merged rows incorrectly when the ID pattern detection misfired.

Users also reported that the column mapping UI (a table of 11–13 field dropdowns) was confusing and unnecessary for their workflow. They want all columns imported in order without manual mapping.

## Decision

Replace both parsers and their UI with a unified, schema-free import engine and a simplified 2-step modal (upload → confirm).

Key decisions made:

1. **Silent auto-mapping, no user-facing mapping step.** Recognized columns are auto-mapped to their semantic fields. Unrecognized columns land in `customData` on the item. The column mapping table is removed from both modals.

2. **Simpler header detection: first qualifying row.** The scoring algorithm is replaced with a rule: the header row is the first row in the top 25 with ≥ 2 non-empty, non-numeric cells that is immediately followed by a non-empty row. The new confirm preview step acts as the safety net for edge-case misdetections.

3. **Skip empty rows, stop only at summary rows or section boundaries.** `extractTableRows` no longer stops at the first blank row.

4. **Drop multi-row merging entirely.** `groupRowsById`, `detectIdColumn`, and `ITEM_ID_PATTERN` are removed. One spreadsheet row = one item.

5. **Add `customData` to FF&E items.** Requires a DB migration and API update. This matches Proposal items and allows all unrecognized import columns to be preserved.

6. **Import Section title → Table Group name.** The single-cell row above the column header becomes the Room (FF&E) or Proposal Category name. If absent, the sheet name is used as fallback.

7. **Isolate Proposal image extraction.** Image extraction from XLSX (renderings, plan images, swatches) remains Proposal-specific post-processing. It does not affect the shared detection/parsing path.

## Consequences

### Positive

- Single detection engine for both table types — bugs fixed once, apply everywhere.
- No manual mapping step means fewer user errors and a dramatically simpler UI.
- Empty rows no longer truncate imports.
- Unrecognized columns are preserved as custom data rather than silently dropped.
- Removing multi-row merging eliminates the phantom-duplicate bug class.

### Negative / Trade-offs

- DB migration required to add `customData` to FF&E items.
- The simpler header detection can misfire on spreadsheets where metadata rows have ≥ 2 text cells and appear before the real header. The confirm preview is the only recovery path; there is no manual fallback.
- Multi-row items (one product spanning several rows) can no longer be merged on import. Users must consolidate them in the spreadsheet first.
- The `headers-missing` fallback flow (user types column names by hand) is removed entirely.

### Neutral

- Existing `engine.ts` tests require updates to match the new detection algorithm behavior.

## Alternatives considered

| Alternative                                         | Why rejected                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Tune the scoring algorithm instead of replacing it  | Weights are fragile; the preview step makes prediction less important than simplicity    |
| Keep multi-row merging for Proposal image path only | Proposal images are column-assigned, not row-range-assigned, so grouping is not required |
| Keep the column mapping UI but pre-fill it          | Still confusing; users confirmed they want all columns imported without mapping          |
| Keep `headers-missing` manual fallback              | Adds complexity; the preview + back-out path is sufficient and simpler                   |
