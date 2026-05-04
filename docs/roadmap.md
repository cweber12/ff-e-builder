# Roadmap

Feature backlog for FF&E Builder. Items are roughly ordered by priority within each section.

---

## In progress / next up

### Product description from URL

- Paste a link into the console.
- Use a web crawler to fetch the product image and description.
- Display the product image and description in the item console.

### Add item — quantity

- Arrow buttons to increment/decrement quantity.
- Quantity must not go below 1.

---

## Planned

### Materials

- Swatches displayed for each item's material.
- Option to set the material for an individual item.

### Material library

- Library of project-specific materials with swatches and material names.
- Add materials to the library with swatch, name, ID, and description.
- Materials should have an image associated with them.
- Select from the library when setting a material for an item.
- Edit swatch and name for existing library entries.
- Delete entries from the library.
- Automatically add a material to the library when assigned to an item for the first time.

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

### Import from Excel — images

- Import item images embedded in an Excel spreadsheet.
  _(Basic Excel import is already complete.)_

### Company information

- Set company name, address, phone number, email, and logo.

### Project information

- Set project name, client name, description, deadline, location, project image, notes, and file attachments.

### Take-off table

- Walls, flooring, ceiling, and paint quantities.
- Uniform cell size; images scale to fit.
- PDF export should render Take-Off Plan Images after the PDF layout cleanup pass.

### Catalog navigation

- Replace Previous / Next buttons with a more intuitive control.
- Slide animation when navigating between catalog pages.
