# Roadmap

Feature backlog for FF&E Builder. Items are roughly ordered by priority within each section.

---

## In progress / next up

### Product description from URL

- Paste a link into the console.
- Use a web crawler to fetch the product image and description.
- Display the product image and description in the item console.

---

## Planned

### Remove background from item images _(requires S3)_

- Per-image option to strip the background.
- API call or client library to perform the removal.
- Download the processed image.

### Branding

- Per-user branding settings.
- Add a logo to the bottom of catalog pages.
- Custom colors and fonts per user _(low priority)_.

### Customer approval

- Workflow for clients to approve or reject items.

### Company information

- Set company name, address, phone number, email, and logo.

### Project information

- Set project name, client name, description, deadline, location, project image, notes, and file attachments.

### Record item revisions and indicate in table

- Revision badge in cell where revision was made (size, swatch, etc.c)
- should open revision log for that item and indicate whether the revision impacted cost.

### Summary tab

- include 'Add expenses' where the user can add expenses for shipping and duties, assembly and installation, sales tax.
- users should be able to add and name additional expenses that are added to budget reports.

### Cells with no values

- should more clearly indicate input and popup fields.

### individual image updates.

---

## UX / polish backlog

_Items flagged in senior frontend review (May 2026). No new data fields required — these are presentation and interaction improvements only._

### FF&E Schedule table

- **Column density** — 15 columns at min-width 1180px inside a 22rem scrollbox. Priority: hide Description and Notes columns by default; surface their content in the Item Detail Panel only. Consider a column visibility toggle.
- **Rendering thumbnail size** — `h-12` (48px) is too small to evaluate a product image. Increase to `h-20` or `h-24`.
- **Status interaction discoverability** — right-click-to-open-menu is undiscoverable for PMs. Add a visible dropdown caret next to the status badge or replace cycle behavior with click-to-open.
- **Empty room state** — "Add first item ->" uses a raw HTML entity arrow. Replace with a proper empty state matching the project-level empty state style.
- **Room images default to collapsed** — `useCollapsedRoomImages` starts all images hidden. Designers surface room images for context; should default open.
- **Description `min-w-64`** — forces Description column wide while content is truncated anyway. Remove or reduce the min-width.

### Item Detail Panel

- **Financials below the fold** — Qty/Unit Cost/Total are at the bottom of the scrollable metadata list. PMs open the panel for cost; move the financial block to the top, below the header.

### Catalog

- **Previous/Next use `&lt;` / `&gt;` HTML entities** — replace with ChevronIcon (already exists in ItemsTable.tsx).
- **Approval section uses web form checkboxes** — `<input type="checkbox">` looks like a browser form, not a printed sign-off page. Replace with print-appropriate styled signature lines and approval boxes. Relates to the planned "Customer approval" workflow.
- **Jump-to-item dropdown** — native `<select>` sitting in a polished sticky nav. Consider a styled combobox or at least bring it visually in line with the surrounding nav.

### Finish Library

- **"No material ID" placeholder** — verbose. Replace with `—`.
- **Delete button has no confirmation** — MaterialGridCard calls `onDelete` directly on click with no modal. Add a confirmation step matching ItemsTable's pattern.
- **Swatch `rounded-full` in table view** — circular crop destroys rectangular texture/fabric images. Use `rounded-md` instead.

## Technical debt

### Route-based code splitting

The entire app ships as a single `index.js` chunk (>500 KB minified). Split by route using `React.lazy()` and dynamic `import()` on each page component, letting Vite emit per-route chunks. This eliminates the Rollup chunk-size warning and improves initial load time, particularly for pages like Plans and Catalog that pull in heavy PDF/canvas dependencies. Raise `build.chunkSizeWarningLimit` temporarily if needed while migrating.
