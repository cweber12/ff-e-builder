# ChillDesignStudio Context

ChillDesignStudio is a project-first specification workspace for interior design teams. A single Project can carry both room-based FF&E work and category-based Proposal work without forcing those tools to share the same table model.

## Language

### Workspace

**Project**:
The top-level design workspace for one client, company, and location.
_Avoid_: Job, file, board

**Project Image**:
A project-level visual used to represent the Project in the project list and exports.
_Avoid_: Cover URL, thumbnail only

**User Profile**:
The preparer contact information used across project documentation.
_Avoid_: Account, auth user

**Company**:
An organizational identity used to group Projects and apply shared presentation defaults.
_Avoid_: Client when referring to the internal design organization

**Company Theme**:
A reusable presentation profile owned by a Company that defines brand color, typography, and sizing defaults for exported documents.
_Avoid_: Per-project styling when referring to shared company defaults

**Budget Mode**:
The Project setting that determines whether FF&E and Proposal share one budget or use separate budgets.
_Avoid_: Budget type, pricing mode

**Project Header**:
The read-only Project identity and tool navigation area shown inside an open Project. Budget status belongs in Summary views, not in the Project Header.
_Avoid_: Budget header, project editor

**Project Snapshot**:
The read-first landing page for an open Project that summarizes FF&E, Proposal, Finish Library, Budget, and attention-needed signals before the user drills into a specific tool.
_Avoid_: Dashboard, summary tab, tool chooser

**Project Options**:
The explicit action menu for maintaining a Project after creation, including updating Project data, managing Project Images, and deleting the Project.
_Avoid_: Inline project editing, hidden project settings

### FF&E

**FF&E**:
The furniture, fixtures, and equipment specification tool for room-based schedules, catalogs, materials, and summaries.
_Avoid_: FFE without ampersand in user-facing text, furniture table

**Room**:
A named project space that groups FF&E Items.
_Avoid_: Category, area

**FF&E Item**:
A room-scoped specification line for a furnishing, fixture, or equipment product.
_Avoid_: Product row, proposal item

**Catalog**:
A printable FF&E presentation where specification items are formatted as item sheets.
_Avoid_: Lookbook, booklet

### Proposal

**Proposal**:
The quantity and cost tool for category-based design or construction scope.
_Avoid_: room table, construction quantity survey

**Export Mode**:
The presentation format used when generating a Proposal export, such as continuous or separated.
_Avoid_: Print style, sheet mode

**Proposal Category**:
A project-scoped grouping for Proposal Items, such as Millwork, Ceiling, Flooring, or Walls.
_Avoid_: Room, item category

**Proposal Item**:
A category-scoped proposal line that captures product tag, plan, drawings, location, size, finish swatches from the Finish Library, CBM, quantity, unit cost, and total cost.
_Avoid_: FF&E item, product only

**Quantity Unit**:
The unit of measure attached to a Proposal Item quantity, such as unit, sq ft, or ln ft.
_Avoid_: Size unit

### Shared Table UI

**Table Group**:
The unit of organisation inside a tool's table view — a **Room** in FF&E, a **Proposal Category** in Proposal. Both tools share table chrome primitives (group header, add-group button, grand total bar, export menu) but own their own column layout and row behaviour separately.
_Avoid_: Section, bucket, container

### Finish Library and Images

**Finish Library**:
The unified project-scoped library of reusable finish entries accessible from both FF&E and Proposal views.
_Avoid_: Material library, swatch library, swatches tab

**Finish Library Filters**:
The filters available in the Finish Library UI: All, Used in FF&E, Used in Proposal. When "Used in FF&E" is active, a secondary Room dropdown narrows to materials assigned within a specific Room. When "Used in Proposal" is active, a secondary Category dropdown narrows to materials assigned within a specific Proposal Category. A material ID search field is always available.
_Avoid_: Materials tab, Swatches tab, classification-based sections

**Import Material ID**:
For spreadsheet imports, when material*id is missing, generate a plain numeric string using the next integer after the current highest numeric material_id in the Project (for example: 1, 2, 3).
\_Avoid*: Zero-padded generated IDs

**Material**:
A Finish Library entry — a finish, fabric, surface, or product material reference. A Material has a name, an optional ID, an optional description, and a visual which is either an uploaded image or a hex color. Image takes precedence over hex color when both are set. There is no type distinction between a material used in FF&E and one used in Proposal; the same entry can be assigned to items in either tool.
_Avoid_: Swatch as a separate entity type; Finish Classification as a user-facing concept

**Material Visual**:
The rendered representation of a Material — either the uploaded image (if present) or a solid block rendered from the Material's hex color. Used as a swatch image in Proposal exports and as an image + ID pair in FF&E exports.
_Avoid_: Swatch color, swatch image (when the distinction is about source, not rendering)

**Swatch Cell**:
The export column in Proposal that renders each assigned Material's visual as an image-only block. No name or ID is shown in the Swatch Cell.
_Avoid_: Materials column when referring to the Proposal export presentation

**Rendering**:
The primary image attached to an FF&E Item or Proposal Item row.
_Avoid_: Screenshot, render URL

**Plan Image**:
A plan visual attached directly to a Proposal Item. In Proposal, the Plan cell is image-only; imported/API Plan text remains stored as fallback export data.
_Avoid_: Rendering, Swatch, drawing when referring to the Plan cell image

**Proposal Spreadsheet Import**:
The workflow that turns an external Proposal spreadsheet into Project Images, Proposal Categories, Proposal Items, Renderings, Plan Images, and Swatches. Header rows may appear below presentation content, single-cell headings can become Proposal Categories, and unmapped spreadsheet data is omitted.
_Avoid_: Raw upload, template-only import

## Relationships

- A **Project** belongs to exactly one authenticated user.
- A **Project** can optionally be associated with one **Company**.
- A **Project** can contain zero or more **Rooms** and zero or more **Proposal Categories**.
- A **Project** has one **FF&E** workspace and one **Proposal** workspace; each can start empty and later be populated.
- A **Company** can define one active **Company Theme** used as the default for document exports.
- A **Room** contains zero or more **FF&E Items**.
- A **Proposal Category** contains zero or more **Proposal Items**.
- A **Project** owns a **Finish Library** — a single pool of **Materials** accessible from both **FF&E** and **Proposal** views.
- All **Finish Library** entries are **Materials**. There is no separate Swatch type; the same **Material** can be assigned to FF&E Items, Proposal Items, or both without any re-classification.
- An **FF&E Item** can reference multiple **Materials** from the **Finish Library**.
- A **Proposal Item** can reference multiple **Materials** from the **Finish Library**.
- Editing a **Finish Library** entry from an item context uses copy-on-write semantics: if the entry is shared across multiple items, a new entry is forked; if it is used exclusively by one item, the entry is updated in place.
- A **Project** can have up to three **Project Images**, with one selected as the preview image.
- A **Project Snapshot** is the default open-project view and links users into FF&E, Proposal, Finish Library, and Budget detail pages.
- A **Project Header** shows only included **Project** identity values and navigation between project tools.
- **Project Options** are available from both Project Cards and the **Project Header** so Project data can be updated without making header fields inline-editable.
- A **Proposal Spreadsheet Import** can create missing **Proposal Categories** from detected category headings or mapped category values.
- A **Proposal Spreadsheet Import** skips subtotal and financial summary rows instead of creating **Proposal Items** from them.
- A **Proposal Spreadsheet Import** migrates embedded swatch images into the **Finish Library** as **Materials** assigned to the imported **Proposal Items**.
- A **Budget Mode** controls whether a **Project** displays one shared budget or separate **FF&E** and **Proposal** budgets.
- A **Proposal** export can use different **Export Modes** without changing the underlying **Proposal Items**.

## Example Dialogue

> **Dev:** "When a designer opens a Project, should we send them straight to the FF&E Item table?"
> **Domain expert:** "No. A Project can have FF&E and Proposal. Show the tool choice first, then let them move between those two tools from the project header."
>
> **Dev:** "Can we reuse Rooms for Millwork and Flooring?"
> **Domain expert:** "No. Rooms group FF&E Items. Millwork and Flooring are Proposal Categories."

## Flagged Ambiguities

- "Item" is overloaded. Use **FF&E Item** for room-scoped specification lines and **Proposal Item** for category-scoped proposal rows.
- "Category" is overloaded. Use **Proposal Category** for table groupings and describe FF&E item category as an item attribute.
- "Swatch" is no longer a separate entity type. All Finish Library entries are **Materials**. "Swatch Cell" remains valid as a rendering term for the Proposal export column — but it describes the column format, not the entry type.
- "FF&E Builder" is the historical repo name. The product shell is **ChillDesignStudio**, and **FF&E** is one tool inside it.
