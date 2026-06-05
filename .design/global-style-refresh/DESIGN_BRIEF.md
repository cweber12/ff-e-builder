# Design Brief: Global Style Refresh

## Problem

The live application shell feels cooler and more blue-gray than desired, which makes the workspace read closer to a generic SaaS tool than a calm, polished interior design specification product. Users need the interface to feel cleaner and more intentional: white content surfaces, crisp dark text, restrained blue emphasis, and subtle separation between workspace regions without harsh black-on-white contrast.

## Solution

Refresh the global visual baseline so the authenticated workspace and supporting screens share one brighter, lighter system. Content surfaces become pure white, the outer shell shifts to a near-white neutral family with only slight warmth to complement the inkier blue accent, text hierarchy relies on near-black and dark gray instead of literal black, and interaction states use neutral grays unless the state is explicitly primary, linked, or focused.

## Experience Principles

1. Calm clarity over cold polish -- The interface should feel clean and structured without drifting into blue-gray enterprise styling.
2. Outline before elevation -- Separation should come primarily from borders and tonal steps, with shadows reserved for genuinely raised UI.
3. Restrained emphasis over decorative branding -- Blue should signal action, focus, and important navigation state, not wash large areas of the UI.

## Aesthetic Direction

- **Philosophy**: Near-white editorial workspace with spec-sheet precision
- **Tone**: Calm, crisp, professional, restrained
- **Reference points**: White drafting surfaces, lightly outlined productivity tools, refined editorial admin interfaces
- **Anti-references**: Cold enterprise blue-gray SaaS; stark black-on-white document app

## Existing Patterns

Components, tokens, and conventions already in the codebase that this design must respect or extend.

- Typography: `Manrope Variable` for live UI, `JetBrains Mono Variable` for tabular/mono contexts in [src/index.css](/c:/Projects/_current-projects/ffe-builder/src/index.css:1) and [tailwind.config.ts](/c:/Projects/_current-projects/ffe-builder/tailwind.config.ts:1)
- Colors: CSS custom properties in `:root` already drive `brand`, `neutral`, `surface`, `canvas`, `paper`, semantic colors, and sidebar tokens in [src/index.css](/c:/Projects/_current-projects/ffe-builder/src/index.css:1)
- Spacing: Existing spacing, radius, and shadow tokens are already centralized in [src/index.css](/c:/Projects/_current-projects/ffe-builder/src/index.css:1); spacing should stay mostly intact with only modest breathing-room adjustments where needed
- Components: Generic UI primitives under `src/components/primitives/`, sidebar primitives under `src/components/shared/sidebar/`, and global utility classes in [src/index.css](/c:/Projects/_current-projects/ffe-builder/src/index.css:281)

## Component Inventory

| Component                      | Status | Notes                                                                                                                     |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Global color tokens            | Modify | Rework `brand`, `neutral`, `surface`, `canvas`, border, and sidebar tokens to the new white + near-white neutral baseline |
| App shell backgrounds          | Modify | Apply the new shell/canvas tones globally, including authenticated workspace and non-auth support pages                   |
| Text hierarchy                 | Modify | Keep current typography stack; shift heading, key-label, body, and meta color mapping only                                |
| Buttons and segmented controls | Modify | Preserve structure; use gray hover/selected surfaces and reserve blue for primary/emphasis states                         |
| Forms and field chrome         | Modify | Inputs, selects, inline editors, and toggles should feel outlined and crisp, not tinted                                   |
| Cards, tables, and panels      | Modify | Pure white content surfaces with border-led separation; avoid cool-gray fills                                             |
| Menus, drawers, and modals     | Modify | Raised elements can keep light shadows, but should inherit the same white/near-white neutral system                       |
| Sidebar and header chrome      | Modify | Stay slightly differentiated from white surfaces using near-white neutral backing and borders                             |

## Key Interactions

The critical interaction patterns. Describe what the user does and what the interface does in response. Focus on state changes, transitions, and feedback.

- Hovering standard controls should produce neutral-gray feedback, not blue-tinted fills.
- Focusing interactive controls should use the inkier blue accent for rings and focus outlines.
- Primary actions, active navigation, and links should use blue as the clearest emphasis signal.
- Selected but non-primary states should remain neutral-led unless the selection represents the active primary context.
- Menus, drawers, modals, and other raised layers should feel outlined first, with restrained shadows used as secondary support.

## Responsive Behavior

How the layout adapts across breakpoints. Note any components that change behavior (not just size) on mobile.

- The color system applies globally across desktop and mobile without introducing a separate mobile theme.
- Desktop sidebars, top chrome, and docked panels should remain subtly differentiated from white content areas.
- On mobile, where panels collapse into stacked sections or full-screen editors, borders and tonal steps must continue to provide separation without relying on heavy fills.
- Any spacing adjustments should be modest and concentrated in headers, panels, and empty states so dense table workflows retain their current efficiency.

## Accessibility Requirements

Minimum requirements for this interface. Include contrast ratios, keyboard navigation, screen reader considerations, and focus management.

- Body text and interactive labels must maintain accessible contrast against white and near-white neutral backgrounds.
- Headings and key labels should stay at a near-black level with stronger contrast than body/meta copy.
- Blue accent usage must preserve accessible contrast for links, primary buttons, active states, and focus indicators.
- Focus-visible treatments must remain explicit and keyboard-discernible across outlined controls, menus, drawers, and modal surfaces.
- Hover-only differentiation is insufficient; active and selected states need non-color cues where applicable through borders, text weight, or outlines.

## Out of Scope

- Changing typography families, introducing new fonts, or performing a typography redesign
- Reworking information architecture, layout structure, or component behavior
- Broad spacing-system refactors beyond modest breathing-room adjustments in key shell areas
- Dark-mode design work
- Brand/logo changes or Company Theme export behavior changes
