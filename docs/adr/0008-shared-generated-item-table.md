# ADR-0008: Shared Generated Item Table Views

| Field      | Value                               |
| ---------- | ----------------------------------- |
| Date       | 2026-05-16                          |
| Status     | Accepted                            |
| Supersedes | ADR-0004 for table/export refactors |

---

## Context

ADR-0004 kept FF&E and Proposal as separate Project-scoped data models because Proposal had different grouping language, columns, units, image needs, and export shape. That separation helped the product grow past the original FF&E-only model.

The current product direction is different: FF&E and Proposal should behave as different views over the same generated item data. The real differences should be view configuration, not separate table behavior. FF&E groups by Room and has FF&E-oriented default columns. Proposal groups by Proposal Category and has Proposal-oriented default columns. Generated item exports should use the same item set and the same table/export document model, with grouping and column presets changing by view.

## Decision

Treat FF&E and Proposal table/export work as a shared Generated Item Table direction.

- FF&E and Proposal are views over shared generated item data.
- FF&E groups Generated Items by Room.
- Proposal groups Generated Items by Proposal Category.
- Creating a furniture item from FF&E should make that item visible in Proposal under the Furniture Proposal Category by default.
- FF&E and Proposal may keep different default columns and labels.
- Table editing, custom column behavior, image/material cell behavior, totals, and CSV/Excel/PDF generated item exports should converge on shared modules with view presets.
- Proposal Revision Round behavior remains Proposal-owned until implementation proves which parts belong in shared generated item behavior.

This ADR records target architecture. It does not require an immediate database migration, file move, or runtime behavior change.

## Consequences

- Future module moves should not fully isolate FF&E and Proposal item-table behavior from each other.
- Shared table/export modules should not import FF&E or Proposal implementation files; FF&E and Proposal should provide view presets or adapters to the shared modules.
- Existing separate `items` and `proposal_items` implementation can be migrated incrementally.
- Generated architecture-map review targets involving shared export code and FF&E/Proposal exports should be evaluated against this shared-table direction rather than treated as automatic isolation violations.
- Documentation and future implementation slices should distinguish current implementation facts from this target direction.
