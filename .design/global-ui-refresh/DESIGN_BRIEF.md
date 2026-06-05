# Design Brief: Global UI Refresh

## Problem

The live application UI feels less cohesive than it should because too many visual dialects coexist at once. Typography shifts between serif, sans, mono, and one-off display choices. Warm tan and parchment-tinted surfaces reduce contrast, so dense data sometimes blends into the background instead of reading clearly. Similar text roles, controls, surfaces, and statuses do not always look like they belong to the same product, which makes the app feel noisier and less professional than the workflows require.

## Solution

Refresh the live app UI into a quieter, more professional workspace centered on a neutral/slate system. Use one primary sans family across the product, reserve mono for numeric/tabular data, replace warm beige/tan surfaces with a clean white-on-light-gray hierarchy, preserve distinct semantic status colors, and simplify component styling so the app reads like one coherent enterprise design tool. The goal is not to make the app more decorative. The goal is to make dense information easier to scan, calmer to work inside, and more trustworthy across tabs and pages.

## Experience Principles

1. Quiet clarity over visual personality -- Every visual choice should help users scan, orient, and act faster; decorative typography, texture, and tinting should be removed from the live app UI.
2. Consistency over local cleverness -- Similar text roles, statuses, actions, panels, and tables should use the same styling rules across FF&E, Item Library, Plans, Materials, Snapshot, and Budget.
3. Spacious precision over crowded density -- The UI should feel calmer and less noisy by simplifying surfaces and spacing, while still staying optimized for desktop/tablet data work rather than becoming oversized or sparse.

## Aesthetic Direction

- **Philosophy**: Quiet professional software
- **Tone**: Calm, precise, trustworthy, modern
- **Reference points**: Linear, Notion Calendar, polished enterprise design tools, restrained productivity software
- **Anti-references**: Editorial/lifestyle layouts, parchment or paper-texture UI, decorative typography, warm beige-tinted shells, overly branded or “designy” flourishes

## Existing Patterns

Components, tokens, and conventions already in the codebase that this design should extend:

- Typography: `src/index.css` and `tailwind.config.ts` already define a system, but the live app mixes `Fraunces`, `Manrope`, `JetBrains Mono`, `Montserrat`, and export-safe stacks. This refresh should standardize the live app on `Manrope` for UI text and `JetBrains Mono` for numeric/tabular data only.
- Colors: `src/index.css` already centralizes `brand`, `neutral`, `surface`, `canvas`, and semantic tokens. This refresh should retune those tokens rather than scatter new hardcoded colors.
- Spacing: `src/index.css` already defines canonical spacing and text-size tokens, but many components still use ad-hoc `text-[10px]`, `text-[11px]`, custom tracking, and local layout patterns. The refresh should collapse these into a smaller set of repeatable roles.
- Components: shared vocabulary already exists through `Button`, `Badge`, `SegmentedControl`, `ProjectToolSidebar`, `.surface-*`, `.card`, `.eyebrow`, `.table-head-cell`, and status primitives. The refresh should normalize those pieces, not replace them with a new system.

## Component Inventory

| Component                                                                         | Status                  | Notes                                                                                                                    |
| --------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Global color tokens in `src/index.css`                                            | Modify                  | Replace warm/tan/parchment bias with cool neutral/slate hierarchy for live app UI.                                       |
| Tailwind theme mapping in `tailwind.config.ts`                                    | Modify                  | Keep token-driven architecture, but align brand/canvas/surface use to the new neutral system.                            |
| Global typography utilities (`body`, headings, `.page-title`, `.eyebrow`, `.num`) | Modify                  | Collapse live UI to all-sans plus mono for data; remove decorative heading treatment from app UI.                        |
| `Button`                                                                          | Modify                  | Simplify action hierarchy, reduce warm hover fills, and make primary/secondary/ghost states quieter and more consistent. |
| `Badge`                                                                           | Modify                  | Keep semantic meaning but standardize shape, contrast, and density with the quieter shell.                               |
| `SegmentedControl`                                                                | Modify                  | Preserve component, but reduce visual noise and align selected/hover states to the new slate system.                     |
| Sidebar shell (`ProjectToolSidebar`, sidebar CSS utilities)                       | Modify                  | Remove tinted heaviness, simplify chrome, improve separation with white/light-gray hierarchy.                            |
| Surface utilities (`.card`, `.surface-paper`, `.surface-flat`)                    | Modify                  | Clarify one consistent surface stack across pages, tabs, panels, and tables.                                             |
| Table typography and header utilities                                             | Modify                  | Normalize text roles, borders, and background contrast for dense scanning.                                               |
| Status primitives (`ItemStatusChip`, `StatusBadge`, proposal status UI)           | Modify                  | Keep semantic colors, but unify the visual language and reduce per-surface variation.                                    |
| Empty/loading states                                                              | Modify                  | Simplify styling, reduce texture/tint reliance, and align copy hierarchy.                                                |
| Export preview styling                                                            | Existing / Out of scope | Live app UI only for this pass; export preview/document styling remains separate for now.                                |

## Key Interactions

- Users should feel immediate visual consistency as they move between Dashboard, Project Snapshot, FF&E, Item Library, Plans, Materials, and Budget. Shared shell regions should no longer restyle themselves dramatically by tab.
- Primary actions should stand out through one consistent treatment. Secondary actions should recede cleanly without looking disabled or improvised.
- Dense data views should be easier to scan because text contrast is stronger, background noise is lower, and row/header/status patterns are more predictable.
- Status indicators should keep semantic color distinctions for `success`, `warning`, and `danger`, but the surrounding UI should remain mostly neutral/slate.
- Hover and selected states should feel lighter and quieter. Interaction feedback should come from subtle contrast, border, and fill changes rather than heavy tinting or flourish.
- Page and panel hierarchy should become easier to parse through consistent title, section-label, body, caption, and numeric roles instead of many one-off size/weight combinations.

## Responsive Behavior

- This refresh is optimized primarily for desktop and tablet work sessions.
- Desktop defines the type scale, spacing rhythm, panel hierarchy, and surface contrast model.
- Tablet should preserve the same visual system with slightly simplified density, not a separate aesthetic.
- Mobile should inherit the same tokens and hierarchy, but may collapse controls, headings, and panel layouts more aggressively to protect usability.
- Responsive adaptation should simplify layout behavior, not introduce alternate color or typography systems.

## Accessibility Requirements

- All live UI text and controls must meet strong contrast targets, with small and dense text treated conservatively.
- Status colors must never be the only signal. Pair them with labels, icons, dots, or consistent chip structure.
- Focus states should remain clearly visible against the lighter neutral shell.
- Dense tables, sidebars, and controls should keep readable text sizing and avoid pale-gray-on-light-gray pairings.
- Typography reduction must improve readability, not just aesthetics: fewer font families, fewer tiny labels, and more consistent weights across repeated roles.

## Out of Scope

- Reworking export documents or export-preview typography/color systems
- Redesigning FF&E catalog document layout, navigator IA, or item-management workflows in this pass
- Changing domain copy, workflow logic, or persistence behavior unrelated to visual styling
- Introducing a dark mode redesign
- Creating a marketing-style or editorial brand layer for the product shell
