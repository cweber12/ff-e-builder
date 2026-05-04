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
A category-scoped take-off line that captures product tag, plan, drawings, location, size, up to four swatches, CBM, quantity, unit cost, and total cost.
_Avoid_: FF&E item, product only

**Quantity Unit**:
The unit of measure attached to a Take-Off Item quantity, such as unit, sq ft, or ln ft.
_Avoid_: Size unit

### Shared Table UI

**Table Group**:
The unit of organisation inside a tool's table view — a **Room** in FF&E, a **Take-Off Category** in Take-Off. Both tools share table chrome primitives (group header, add-group button, grand total bar, export menu) but own their own column layout and row behaviour separately.
_Avoid_: Section, bucket, container

### Materials And Images

**Material**:
A reusable project library entry for a finish, fabric, product material, or swatch reference.
_Avoid_: Finish only, swatch only

**Swatch**:
A visual material image reference shown on an FF&E Item or Take-Off Item.
_Avoid_: Material when referring only to the visual sample

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
- A **Company** can define one active **Company Theme** used as the default for document exports.
- A **Room** contains zero or more **FF&E Items**.
- A **Take-Off Category** contains zero or more **Take-Off Items**.
- A **Project** owns a shared **Material** library that can be accessed from both **FF&E** and **Take-Off Table** views.
- An **FF&E Item** can use multiple **Materials**.
- A **Take-Off Item** can show up to four **Swatches**.
- A **Take-Off Item** can have one optional **Rendering**, one optional **Plan Image**, and up to four optional **Swatches**.
- A **Take-Off Item** owns its **Swatches** directly for this pass instead of selecting them from the shared **Material** library.
- A **Project** can have up to three **Project Images**, with one selected as the preview image.
- A **Project Header** shows only included **Project** identity values and navigation between project tools.
- **Project Options** are available from both Project Cards and the **Project Header** so Project data can be updated without making header fields inline-editable.
- A **Take-Off Spreadsheet Import** can create missing **Take-Off Categories** from detected category headings or mapped category values.
- A **Take-Off Spreadsheet Import** skips subtotal and financial summary rows instead of creating **Take-Off Items** from them.
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
- "Swatch" and "Material" overlap in the UI. The canonical library concept is **Material**; **Swatch** is the visual reference shown on a row.
- For this pass, **Take-Off Swatches** are not project-library **Materials**; they are direct image attachments owned by a **Take-Off Item**.
- "FF&E Builder" is the historical repo name. The product shell is **ChillDesignStudio**, and **FF&E** is one tool inside it.
