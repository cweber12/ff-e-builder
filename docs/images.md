# Image Storage

FF&E Builder stores image bytes in a private Cloudflare R2 bucket named
`ffe-images`. The React app never talks to R2 directly and never uses public
bucket URLs. All image access goes through the authenticated Cloudflare Worker.

## Data Model

Image metadata is normalized in `image_assets`:

- `owner_uid` scopes every image to the Firebase user.
- `project_id` is always populated.
- `room_id` is populated for room and item images.
- `item_id` is populated for item images.
- `material_id` is populated for material library images.
- `takeoff_item_id` is populated for take-off table rendering images.
- `r2_key` points to the private object in R2.

The R2 object key shape is:

```text
users/{uid}/projects/{projectId}/project/{imageId}.{ext}
users/{uid}/projects/{projectId}/rooms/{roomId}/{imageId}.{ext}
users/{uid}/projects/{projectId}/rooms/{roomId}/items/{itemId}/{imageId}.{ext}
users/{uid}/projects/{projectId}/materials/{materialId}/{imageId}.{ext}
users/{uid}/projects/{projectId}/takeoff/items/{takeoffItemId}/{imageId}.{ext}
```

## API

All endpoints require the same Firebase bearer token as the rest of the API.
Unauthorized or cross-user access returns `404` to avoid leaking resource
existence.

- `GET /api/v1/images?entity_type=project&entity_id={projectId}`
- `GET /api/v1/images?entity_type=room&entity_id={roomId}`
- `GET /api/v1/images?entity_type=item&entity_id={itemId}`
- `GET /api/v1/images?entity_type=material&entity_id={materialId}`
- `GET /api/v1/images?entity_type=takeoff_item&entity_id={takeoffItemId}`
- `POST /api/v1/images?entity_type=...&entity_id=...&alt_text=...`
  - multipart form field: `file`
  - allowed types: JPEG, PNG, WebP, GIF
  - max size: 5 MB
- `GET /api/v1/images/{imageId}/content`
- `DELETE /api/v1/images/{imageId}`

Downloads are served by the Worker from R2 with `private, max-age=3600` cache
headers. The frontend should fetch image blobs with the authenticated API client
and render object URLs, revoking those URLs when components unmount.

## Frontend Placement

The shared image frame is used for:

- project cards on `/projects`
- room image frames beside each room table on `/projects/:id/table`
- item thumbnails before the item ID on the table view
- catalog item image slots on `/projects/:id/catalog`
- material cards in the project material library
- take-off rendering cells on `/projects/:id/takeoff`

Empty frames open the local file picker. Existing frames render the protected R2
image through an authenticated blob request rather than a public URL.

## Manual Cloudflare Steps

1. Confirm the R2 bucket exists:

   ```bash
   pnpm --dir api exec wrangler r2 bucket list
   ```

   If needed, create it:

   ```bash
   pnpm --dir api exec wrangler r2 bucket create ffe-images
   ```

2. Confirm `api/wrangler.toml` includes the binding:

   ```toml
   [[r2_buckets]]
   binding = "IMAGES_BUCKET"
   bucket_name = "ffe-images"
   ```

3. Keep the bucket private. Do not enable public bucket access or expose a
   custom public R2 domain for user images.

4. Deploy the Worker after the database migration is applied:

   ```bash
   pnpm --dir api deploy
   ```

## Manual Neon Step

Apply the migration after setting `NEON_DATABASE_URL` in the shell:

```bash
pnpm migrate
```

This applies `db/migrations/0002_image_assets.sql` and later image-related
migrations such as `db/migrations/0003_material_library.sql`. Material images
require that migration because it adds the `image_assets.material_id` reference
and material-specific primary-image index.
