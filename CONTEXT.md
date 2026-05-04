# ChillDesignStudio Context

ChillDesignStudio is a project-first specification workspace for interior design teams. A single Project can carry both room-based FF&E work and category-based Take-Off work without forcing those tools to share the same table model.

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
The Project setting that determines whether FF&E and Take-Off share one budget or use separate budgets.
_Avoid_: Budget type, pricing mode

**Project Header**:
The read-only Project identity and tool navigation area shown inside an open Project. Budget status belongs in Summary views, not in the Project Header.
_Avoid_: Budget header, project editor

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
_Avoid_: Product row, take-off item

**Catalog**:
A printable FF&E presentation where specification items are formatted as item sheets.
_Avoid_: Lookbook, booklet

### Take-Off

**Take-Off Table**:
The quantity and cost tool for category-based design or construction scope.
_Avoid_: Takeoff tab, takeoff room table

**Export Mode**:
The presentation format used when generating a Take-Off export, such as continuous or separated.
_Avoid_: Print style, sheet mode

**Take-Off Category**:
A project-scoped grouping for Take-Off Items, such as Millwork, Ceiling, Flooring, or Walls.
_Avoid_: Room, item category

**Take-Off Item**:
A category-scoped take-off line that captures product tag, plan, drawings, location, size, finish swatches from the Finish Library, CBM, quantity, unit cost, and total cost.
_Avoid_: FF&E item, product only

**Quantity Unit**:
The unit of measure attached to a Take-Off Item quantity, such as unit, sq ft, or ln ft.
_Avoid_: Size unit

### Shared Table UI

**Table Group**:
The unit of organisation inside a tool's table view — a **Room** in FF&E, a **Take-Off Category** in Take-Off. Both tools share table chrome primitives (group header, add-group button, grand total bar, export menu) but own their own column layout and row behaviour separately.
_Avoid_: Section, bucket, container

### Finish Library and Images

**Finish Library**:
The unified project-scoped library of reusable finish entries accessible from both FF&E and Take-Off Table views.
_Avoid_: Material library, swatch library, swatches tab

**Finish Library Sections**:
The standard library filters used in UI: Materials, Swatches, and All Finishes.
_Avoid_: Generic "All" when context is the Finish Library

**Finish Classification**:
The explicit classification on a Finish Library entry used to separate library sections and defaults for import workflows (Material, Swatch, or Hybrid).
_Avoid_: Implicit type by table only

**Import Material ID**:
For spreadsheet imports, when material*id is missing, generate a plain numeric string using the next integer after the current highest numeric material_id in the Project (for example: 1, 2, 3).
\_Avoid*: Zero-padded generated IDs

**Material**:
A Finish Library entry assigned to an FF&E Item — a finish, fabric, or product material reference used in furniture specification.
_Avoid_: Swatch when referring to the FF&E context

**Swatch**:
A Finish Library entry assigned to a Take-Off Item — a surface finish or wall/ceiling material reference used in take-off scope.
_Avoid_: Material when referring to the Take-Off context

**Rendering**:
The primary image attached to an FF&E Item or Take-Off Item row.
_Avoid_: Screenshot, render URL

**Plan Image**:
A plan visual attached directly to a Take-Off Item. In the Take-Off Table, the Plan cell is image-only; imported/API Plan text remains stored as fallback export data.
_Avoid_: Rendering, Swatch, drawing when referring to the Plan cell image

**Take-Off Spreadsheet Import**:
The workflow that turns an external Take-Off spreadsheet into Project Images, Take-Off Categories, Take-Off Items, Renderings, Plan Images, and Swatches. Header rows may appear below presentation content, single-cell headings can become Take-Off Categories, and unmapped spreadsheet data is omitted.
_Avoid_: Raw upload, template-only import

## Relationships

- A **Project** belongs to exactly one authenticated user.
- A **Project** can optionally be associated with one **Company**.
- A **Project** can contain zero or more **Rooms** and zero or more **Take-Off Categories**.
- A **Project** has one **FF&E** workspace and one **Take-Off Table** workspace; each can start empty and later be populated.
- A **Company** can define one active **Company Theme** used as the default for document exports.
- A **Room** contains zero or more **FF&E Items**.
- A **Take-Off Category** contains zero or more **Take-Off Items**.
- A **Project** owns a **Finish Library** — a single pool of entries accessible from both **FF&E** and **Take-Off Table** views.
- **Materials** (FF&E) and **Swatches** (Take-Off) are stored as the same entity type in the **Finish Library** and carry a **Finish Classification** used for section filters and import defaults.
- When a **Finish Library** entry is copied from one context to the other (e.g., a **Material** used as a **Swatch**), a new independent entry is created with identical image and text fields.
- An **FF&E Item** can reference multiple **Materials** from the **Finish Library**.
- A **Take-Off Item** can reference multiple **Swatches** from the **Finish Library**.
- A **Take-Off Item** can have one optional **Rendering**, one optional **Plan Image**, and zero or more **Swatches** from the **Finish Library**.
- Editing a **Finish Library** entry from an item context uses copy-on-write semantics: if the entry is shared across multiple items, a new entry is forked; if it is used exclusively by one item, the entry is updated in place.
- A **Project** can have up to three **Project Images**, with one selected as the preview image.
- A **Project Header** shows only included **Project** identity values and navigation between project tools.
- **Project Options** are available from both Project Cards and the **Project Header** so Project data can be updated without making header fields inline-editable.
- A **Take-Off Spreadsheet Import** can create missing **Take-Off Categories** from detected category headings or mapped category values.
- A **Take-Off Spreadsheet Import** skips subtotal and financial summary rows instead of creating **Take-Off Items** from them.
- A **Take-Off Spreadsheet Import** migrates embedded swatch images into the **Finish Library** as **Swatches** assigned to the imported **Take-Off Items**.
- A **Budget Mode** controls whether a **Project** displays one shared budget or separate **FF&E** and **Take-Off Table** budgets.
- A **Take-Off Table** export can use different **Export Modes** without changing the underlying **Take-Off Items**.

## Example Dialogue

> **Dev:** "When a designer opens a Project, should we send them straight to the FF&E Item table?"
> **Domain expert:** "No. A Project can have FF&E and a Take-Off Table. Show the tool choice first, then let them move between those two tools from the project header."
>
> **Dev:** "Can we reuse Rooms for Millwork and Flooring?"
> **Domain expert:** "No. Rooms group FF&E Items. Millwork and Flooring are Take-Off Categories."

## Flagged Ambiguities

- "Item" is overloaded. Use **FF&E Item** for room-scoped specification lines and **Take-Off Item** for category-scoped take-off rows.
- "Category" is overloaded. Use **Take-Off Category** for table groupings and describe FF&E item category as an item attribute.
- "Swatch" and "Material" name the same underlying entity type with different semantic roles. Use **Material** for FF&E context and **Swatch** for Take-Off context; both are **Finish Library** entries.
- "FF&E Builder" is the historical repo name. The product shell is **ChillDesignStudio**, and **FF&E** is one tool inside it.
