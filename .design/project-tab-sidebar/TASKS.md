# Build Tasks: Project Tab Sidebar Refresh

Generated from: .design/project-tab-sidebar/DESIGN_BRIEF.md
Date: 2026-06-01

## Foundation

- [ ] **Stabilize Plans sidebar portal wiring**: Ensure Plans summary/filter/action portal targets rebind correctly after sidebar collapse and remount so controls never disappear on reopen. Done when close/reopen cycles always restore controls without user refresh. _Modifies: src/pages/PlansPage.tsx. Reuses: existing slot IDs and portal architecture._
- [ ] **Define unified sidebar section shell rules**: Establish a single structural pattern for section ordering and labeling (context -> filters -> actions) and apply to shared sidebar container composition. Done when tabs follow consistent hierarchy with reduced visual noise. _Modifies: src/components/shared/sidebar/ProjectTabToolbarSidebar.tsx and existing sidebar CSS utilities._

## Core UI

- [ ] **Replace verbose panel toggle with pinned icon control**: Swap Open/Close text button for compact icon toggle with tooltip and explicit expanded/collapsed semantics. Done when state is obvious at a glance and keyboard accessible. _Modifies: src/components/project/ProjectHeader.tsx. Reuses: existing header tab row and panelCollapsed state._
- [ ] **Introduce collapsed rail orientation affordance**: Add slim collapsed rail with active context indicator and icon affordances to preserve orientation when panel is hidden. Done when users can tell current workspace state before reopening. _Modifies: src/components/shared/sidebar/ProjectTabToolbarSidebar.tsx and sidebar styles. New: collapsed rail subcomponent if needed._

## Interactions & States

- [ ] **Harden Plans state persistence across collapse/reopen**: Preserve selected filter and sort state while ensuring UI controls re-render after remount. Covers repeated toggles, route-stable state, and action control availability. _Modifies: src/pages/PlansPage.tsx and tests in src/pages/PlansPage.test.tsx._
- [ ] **Reduce sidebar noise and tighten action hierarchy**: Normalize spacing, typographic emphasis, and selected/hover behavior for sidebar controls so primary actions stand out without clutter. Covers idle, hover, active, selected, disabled states. _Modifies: shared sidebar CSS and SidebarButton behavior._

## Responsive & Polish

- [ ] **Desktop/tablet behavior pass for sidebar shell**: Validate compact spacing and hierarchy at desktop and tablet widths while preserving mobile fallback discoverability. Breakpoints: lg primary, md secondary. _Modifies: shared sidebar layout classes/styles._
- [ ] **Accessibility verification pass**: Ensure WCAG 2.1 AA contrast, focus-visible styles, semantic labels, keyboard navigation, and aria-expanded/aria-current integrity for toggle/rail/sections. _Modifies: relevant sidebar/header components and tests as needed._

## Review

- [ ] **Design review**: Run design review against .design/project-tab-sidebar/DESIGN_BRIEF.md and resolve any fidelity gaps.
