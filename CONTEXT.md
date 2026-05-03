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

**Budget Mode**:
The Project setting that determines whether FF&E and Take-Off share one budget or use separate budgets.
_Avoid_: Budget type, pricing mode

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

**Take-Off Category**:
A project-scoped grouping for Take-Off Items, such as Millwork, Ceiling, Flooring, or Walls.
_Avoid_: Room, item category

**Take-Off Item**:
A category-scoped take-off line that captures product tag, plan, drawings, location, size, swatches, CBM, quantity, unit cost, and total cost.
_Avoid_: FF&E item, product only

**Quantity Unit**:
The unit of measure attached to a Take-Off Item quantity, such as unit, sq ft, or ln ft.
_Avoid_: Size unit

### Materials And Images

**Material**:
A reusable project library entry for a finish, fabric, product material, or swatch reference.
_Avoid_: Finish only, swatch only

**Swatch**:
A visual or named material reference shown on an FF&E Item or Take-Off Item.
_Avoid_: Material when referring only to the visual sample

**Rendering**:
The primary image attached to an FF&E Item or Take-Off Item row.
_Avoid_: Screenshot, render URL

## Relationships

- A **Project** belongs to exactly one authenticated user.
- A **Project** can contain zero or more **Rooms** and zero or more **Take-Off Categories**.
- A **Room** contains zero or more **FF&E Items**.
- A **Take-Off Category** contains zero or more **Take-Off Items**.
- A **Project** owns a shared **Material** library that can be accessed from both **FF&E** and **Take-Off Table** views.
- An **FF&E Item** can use multiple **Materials**.
- A **Take-Off Item** can show multiple **Swatches**.
- A **Project** can have up to three **Project Images**, with one selected as the preview image.
- A **Budget Mode** controls whether a **Project** displays one shared budget or separate **FF&E** and **Take-Off Table** budgets.

## Example Dialogue

> **Dev:** "When a designer opens a Project, should we send them straight to the FF&E Item table?"
> **Domain expert:** "No. A Project can have FF&E and a Take-Off Table. Show the tool choice first, then let them move between those two tools from the project header."
>
> **Dev:** "Can we reuse Rooms for Millwork and Flooring?"
> **Domain expert:** "No. Rooms group FF&E Items. Millwork and Flooring are Take-Off Categories."

## Flagged Ambiguities

- "Item" is overloaded. Use **FF&E Item** for room-scoped specification lines and **Take-Off Item** for category-scoped take-off rows.
- "Category" is overloaded. Use **Take-Off Category** for table groupings and describe FF&E item category as an item attribute.
- "Swatch" and "Material" overlap in the UI. The canonical library concept is **Material**; **Swatch** is the visual or named reference shown on a row.
- "FF&E Builder" is the historical repo name. The product shell is **ChillDesignStudio**, and **FF&E** is one tool inside it.
