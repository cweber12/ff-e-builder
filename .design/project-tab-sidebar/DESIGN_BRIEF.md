# Design Brief: Project Tab Sidebar Refresh

## Problem

When users work across FF&E, Proposal, Plans, Materials, and Budget, the left sidebar feels inconsistent and noisy. The open/close control reads as verbose instead of intuitive, and reopening the Plans sidebar can result in missing controls, which breaks trust and interrupts flow. Users are forced to re-orient and hunt for actions that should be obvious.

## Solution

Redesign the project tab sidebar into a calm, structured control rail that prioritizes context first, then filtering, then actions. Replace the current text-heavy panel toggle with a compact pinned icon control that clearly communicates expanded/collapsed state. Preserve a slim collapsed rail with active-state orientation and ensure all Plans controls and state persist and render correctly after collapse/reopen.

## Experience Principles

1. Orientation over density -- The user should always know where they are and what mode they are in before seeing secondary controls.
2. Progressive disclosure over visual noise -- Show high-priority controls by default and defer secondary controls to grouped sections or menus.
3. Confidence over cleverness -- State persistence, predictable layout, and clear control affordances matter more than novelty.

## Aesthetic Direction

- **Philosophy**: Editorial control rail for a professional planning workspace; restrained, information-forward, and highly legible.
- **Tone**: Calm, professional, precise.
- **Reference points**: Linear and Notion-style information hierarchy (clear sectioning, minimal ornament, high scannability).
- **Anti-references**: Crowded enterprise admin sidebars, over-decorated controls, or heavy visual chrome that competes with content.

## Existing Patterns

Components, tokens, and conventions already in the codebase that this design must respect or extend.

- Typography: Manrope Variable and DM Sans Variable for UI text, Fraunces Variable for headings, JetBrains Mono Variable for numeric/meta contexts.
- Colors: CSS custom properties in `:root` with warm neutral surfaces and brand blue accents (`--color-brand-*`, `--color-neutral-*`, `--color-canvas-*`), consumed via Tailwind theme extension.
- Spacing: Tokenized spacing and compact control rhythm (notably 8px/12px-ish cadence in sidebar controls), with `--space-*` and tight `h-8` toolbar/button vocabulary.
- Components: Existing reusable sidebar primitives and toolbar patterns should be the base vocabulary, not replaced.

## Component Inventory

| Component                                                  | Status | Notes                                                                                        |
| ---------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Project tab sidebar container (`ProjectTabToolbarSidebar`) | Modify | Reorganize section hierarchy and collapsed behavior while keeping portal slot architecture.  |
| Header panel toggle (`ProjectHeader` panel control)        | Modify | Replace Open/Close text button with pinned icon control + tooltip + ARIA-expanded semantics. |
| Sidebar action button (`SidebarButton`)                    | Modify | Tighten visual cohesion and selected/hover hierarchy for calmer scan behavior.               |
| Sidebar grouped actions (`SidebarButtonGroup`)             | Exists | Keep and reuse for action stacks; align spacing/labels with new hierarchy.                   |
| Plans filter rail portal (`PlansFilterBar`)                | Modify | Ensure robust remount behavior after collapse/reopen; controls must always rebind.           |
| Plans actions portal (`PlansActionsBar`)                   | Modify | Persist sort/action rendering across sidebar mount cycles.                                   |
| Plans summary portal (`PlansSummaryBar`)                   | Modify | Preserve and rehydrate summary content after reopen without user action.                     |
| Collapsed rail affordance                                  | New    | Slim icon rail with active indicator, tooltip labels, and keyboard support.                  |
| Sidebar section shell (context, filters, actions)          | New    | Reusable section framing pattern for all project tabs to reduce noise and drift.             |

## Key Interactions

- User toggles sidebar with a pinned icon control in the project header; icon state, tooltip, and assistive text update immediately.
- When collapsed, a slim rail remains visible with key tab-context icons and active section indicator.
- When expanded, section order is fixed: context/view summary first, filters second, primary actions third.
- Plans sidebar content (summary, filters, sort, upload action) remains present and accurate after collapse/reopen; no empty state appears unless true data-empty conditions apply.
- Focus management is explicit: keyboard users can toggle panel, traverse collapsed rail items, and land in the first logical control when expanding.

## Responsive Behavior

- Desktop-first interaction model.
- Tablet keeps the same information hierarchy with slightly compressed spacing and icon+label balancing.
- Mobile fallback may collapse to a top-sheet or drawer trigger, but preserves the same section order and state persistence.
- Collapsed rail behavior is primarily desktop/tablet; mobile should prioritize discoverability over persistent rail chrome.

## Accessibility Requirements

- Meet WCAG 2.1 AA contrast for all sidebar text, icons, dividers, and focus indicators.
- Full keyboard navigation for panel toggle, collapsed rail controls, section controls, and action buttons.
- Use semantic landmarks/labels for sidebar and sections; expose expanded/collapsed state with ARIA.
- Preserve visible focus rings and logical tab order through both collapsed and expanded modes.
- Ensure dynamic updates (panel state, section content availability) are announced appropriately for assistive technologies.

## Out of Scope

- Redesign of core page content areas outside the project tab sidebar shell.
- New cross-product visual brand overhaul beyond sidebar-specific cohesion updates.
- Re-architecting unrelated data fetching flows not tied to sidebar mount/reopen reliability.
- Changes to Plans card grid, upload modal internals, or plan canvas tool behavior beyond sidebar entry-point affordances.
