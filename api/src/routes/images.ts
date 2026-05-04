import { Hono } from 'hono';
import type { Env, HonoVariables, ImageAsset, ImageEntityType } from '../types';
import { ImageListQuerySchema, ImageUploadQuerySchema } from '../types';
import { getDb } from '../lib/db';
import {
  getOwnedItemContext,
  getOwnedMaterialContext,
  getOwnedProjectContext,
  getOwnedRoomContext,
  getOwnedTakeoffItemContext,
} from '../lib/ownership';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type EntityContext = {
  projectId: string;
  roomId: string | null;
  itemId: string | null;
  materialId: string | null;
  takeoffItemId: string | null;
};

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

function cleanFilename(filename: string): string {
  const trimmed = filename.trim().replace(/[/\\]/g, '-');
  return trimmed.length > 0 ? trimmed.slice(0, 255) : 'image';
}

function imageRow(row: unknown): ImageAsset {
  return row as ImageAsset;
}

function imageInsertErrorMessage(entityType: ImageEntityType, err: unknown): string | null {
  const message = err instanceof Error ? err.message.toLowerCase() : '';

  if (message.includes('projects can have up to 3 images')) {
    return 'Projects can have up to 3 images';
  }

  if (message.includes('take-off items can have up to 4 swatches')) {
    return 'Take-Off items can have up to 4 swatches';
  }

  if (!message.includes('duplicate key value violates unique constraint')) return null;

  if (entityType === 'project') return 'Projects can have only one preview image at a time';
  if (entityType === 'item' || entityType === 'takeoff_item') {
    return 'This row already has a rendering';
  }
  if (entityType === 'takeoff_plan') return 'This row already has a plan image';
  if (entityType === 'room') return 'This room already has an image';
  if (entityType === 'material') return 'This material already has an image';
  return 'An image already exists for this entity';
}

function isProjectImageAsset(image: ImageAsset): boolean {
  return (
    image.room_id === null &&
    image.item_id === null &&
    image.material_id === null &&
    image.takeoff_item_id === null &&
    image.entity_type === 'project'
  );
}

async function getOwnedEntityContext(
  env: Env,
  entityType: ImageEntityType,
  entityId: string,
  uid: string,
): Promise<EntityContext> {
  if (entityType === 'project') {
    const project = await getOwnedProjectContext(env, entityId, uid);
    return {
      projectId: project.projectId,
      roomId: null,
      itemId: null,
      materialId: null,
      takeoffItemId: null,
    };
  }

  if (entityType === 'room') {
    const room = await getOwnedRoomContext(env, entityId, uid);
    return {
      projectId: room.projectId,
      roomId: room.roomId,
      itemId: null,
      materialId: null,
      takeoffItemId: null,
    };
  }

  if (entityType === 'material') {
    const material = await getOwnedMaterialContext(env, entityId, uid);
    return {
      projectId: material.projectId,
      roomId: null,
      itemId: null,
      materialId: material.materialId,
      takeoffItemId: null,
    };
  }

  if (entityType === 'takeoff_item' || entityType === 'takeoff_plan') {
    const takeoffItem = await getOwnedTakeoffItemContext(env, entityId, uid);
    return {
      projectId: takeoffItem.projectId,
      roomId: null,
      itemId: null,
      materialId: null,
      takeoffItemId: takeoffItem.takeoffItemId,
    };
  }

  const item = await getOwnedItemContext(env, entityId, uid);
  return {
    projectId: item.projectId,
    roomId: item.roomId,
    itemId: item.itemId,
    materialId: null,
    takeoffItemId: null,
  };
}

function buildR2Key(
  uid: string,
  entityType: ImageEntityType,
  context: EntityContext,
  imageId: string,
  ext: string,
): string {
  const base = `users/${uid}/projects/${context.projectId}`;
  if (entityType === 'project') return `${base}/project/${imageId}.${ext}`;
  if (entityType === 'room') return `${base}/rooms/${context.roomId}/${imageId}.${ext}`;
  if (entityType === 'material') return `${base}/materials/${context.materialId}/${imageId}.${ext}`;
  if (entityType === 'takeoff_item') {
    return `${base}/takeoff/items/${context.takeoffItemId}/${imageId}.${ext}`;
  }
  if (entityType === 'takeoff_plan') {
    return `${base}/takeoff/items/${context.takeoffItemId}/plan/${imageId}.${ext}`;
  }
  return `${base}/rooms/${context.roomId}/items/${context.itemId}/${imageId}.${ext}`;
}

async function getOwnedImage(env: Env, imageId: string, uid: string): Promise<ImageAsset> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT *
    FROM image_assets
    WHERE id = ${imageId} AND owner_uid = ${uid}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('not_found');
  return imageRow(rows[0]);
}

router.get('/', async (c) => {
  const parsed = ImageListQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const uid = c.get('uid');
  let context: EntityContext;
  try {
    context = await getOwnedEntityContext(
      c.env,
      parsed.data.entity_type,
      parsed.data.entity_id,
      uid,
    );
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT *
    FROM image_assets
    WHERE owner_uid = ${uid}
      AND project_id = ${context.projectId}
      AND entity_type = ${parsed.data.entity_type}
      AND room_id IS NOT DISTINCT FROM ${context.roomId}
      AND item_id IS NOT DISTINCT FROM ${context.itemId}
      AND material_id IS NOT DISTINCT FROM ${context.materialId}
      AND takeoff_item_id IS NOT DISTINCT FROM ${context.takeoffItemId}
    ORDER BY is_primary DESC, created_at DESC
  `;

  return c.json({ images: rows.map(imageRow) });
});

router.post('/', async (c) => {
  const parsed = ImageUploadQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const uid = c.get('uid');
  let context: EntityContext;
  try {
    context = await getOwnedEntityContext(
      c.env,
      parsed.data.entity_type,
      parsed.data.entity_id,
      uid,
    );
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const body = await c.req.parseBody().catch(() => null);
  const file = body?.['file'];
  if (!(file instanceof File)) return c.json({ error: 'Image file is required' }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ error: 'Unsupported image type' }, 415);
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return c.json({ error: 'Image must be between 1 byte and 5 MB' }, 413);
  }

  const imageId = crypto.randomUUID();
  const ext = extensionForContentType(file.type);
  const r2Key = buildR2Key(uid, parsed.data.entity_type, context, imageId, ext);

  await c.env.IMAGES_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'private, max-age=3600',
    },
    customMetadata: {
      ownerUid: uid,
      projectId: context.projectId,
      entityType: parsed.data.entity_type,
      imageId,
      materialId: context.materialId ?? '',
      takeoffItemId: context.takeoffItemId ?? '',
    },
  });

  const sql = getDb(c.env);
  let projectImageCount = 0;
  try {
    if (parsed.data.entity_type === 'project') {
      const existing = await sql`
        SELECT COUNT(*)::int AS count
        FROM image_assets
        WHERE owner_uid = ${uid}
          AND project_id = ${context.projectId}
          AND entity_type = 'project'
          AND room_id IS NULL
          AND item_id IS NULL
          AND material_id IS NULL
          AND takeoff_item_id IS NULL
      `;
      const count = (existing[0] as { count?: number } | undefined)?.count ?? 0;
      projectImageCount = count;
      if (count >= 3) {
        await c.env.IMAGES_BUCKET.delete(r2Key).catch(() => undefined);
        return c.json({ error: 'Projects can have up to 3 images' }, 400);
      }
    }

    const isPrimary = parsed.data.entity_type === 'project' ? projectImageCount === 0 : true;

    if (parsed.data.entity_type === 'project') {
      const rows = await sql`
        INSERT INTO image_assets (
          id, entity_type, owner_uid, project_id, room_id, item_id, material_id, takeoff_item_id, r2_key,
          filename, content_type, byte_size, alt_text, is_primary
        )
        VALUES (
          ${imageId},
          ${parsed.data.entity_type},
          ${uid},
          ${context.projectId},
          ${context.roomId},
          ${context.itemId},
          ${context.materialId},
          ${context.takeoffItemId},
          ${r2Key},
          ${cleanFilename(file.name)},
          ${file.type},
          ${file.size},
          ${parsed.data.alt_text},
          ${isPrimary}
        )
        RETURNING *
      `;
      return c.json({ image: imageRow(rows[0]) }, 201);
    }

    const rows = await sql`
      WITH demote_existing AS (
        UPDATE image_assets
        SET is_primary = false
        WHERE owner_uid = ${uid}
          AND project_id = ${context.projectId}
          AND entity_type = ${parsed.data.entity_type}
          AND room_id IS NOT DISTINCT FROM ${context.roomId}
          AND item_id IS NOT DISTINCT FROM ${context.itemId}
          AND material_id IS NOT DISTINCT FROM ${context.materialId}
          AND takeoff_item_id IS NOT DISTINCT FROM ${context.takeoffItemId}
      )
      INSERT INTO image_assets (
        id, entity_type, owner_uid, project_id, room_id, item_id, material_id, takeoff_item_id, r2_key,
        filename, content_type, byte_size, alt_text, is_primary
      )
      VALUES (
        ${imageId},
        ${parsed.data.entity_type},
        ${uid},
        ${context.projectId},
        ${context.roomId},
        ${context.itemId},
        ${context.materialId},
        ${context.takeoffItemId},
        ${r2Key},
        ${cleanFilename(file.name)},
        ${file.type},
        ${file.size},
        ${parsed.data.alt_text},
        ${isPrimary}
      )
      RETURNING *
    `;
    return c.json({ image: imageRow(rows[0]) }, 201);
  } catch (err) {
    await c.env.IMAGES_BUCKET.delete(r2Key).catch(() => undefined);
    const validationError = imageInsertErrorMessage(parsed.data.entity_type, err);
    if (validationError) return c.json({ error: validationError }, 409);
    throw err;
  }
});

router.patch('/:id/primary', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  let image: ImageAsset;
  try {
    image = await getOwnedImage(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    WITH demote_existing AS (
      UPDATE image_assets
      SET is_primary = false
      WHERE owner_uid = ${uid}
        AND project_id = ${image.project_id}
        AND entity_type = ${image.entity_type}
        AND room_id IS NOT DISTINCT FROM ${image.room_id}
        AND item_id IS NOT DISTINCT FROM ${image.item_id}
        AND material_id IS NOT DISTINCT FROM ${image.material_id}
        AND takeoff_item_id IS NOT DISTINCT FROM ${image.takeoff_item_id}
    )
    UPDATE image_assets
    SET is_primary = true
    WHERE id = ${id} AND owner_uid = ${uid}
    RETURNING *
  `;

  return c.json({ image: imageRow(rows[0]) });
});

router.get('/:id/content', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  let image: ImageAsset;
  try {
    image = await getOwnedImage(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const object = await c.env.IMAGES_BUCKET.get(image.r2_key);
  if (!object) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', image.content_type);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Content-Length', image.byte_size.toString());
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(object.body, { headers });
});

router.delete('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  let image: ImageAsset;
  try {
    image = await getOwnedImage(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`DELETE FROM image_assets WHERE id = ${id} AND owner_uid = ${uid}`;

  if (image.is_primary && isProjectImageAsset(image)) {
    const nextRows = await sql`
      SELECT *
      FROM image_assets
      WHERE owner_uid = ${uid}
        AND project_id = ${image.project_id}
        AND entity_type = 'project'
        AND room_id IS NULL
        AND item_id IS NULL
        AND material_id IS NULL
        AND takeoff_item_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const nextImage = nextRows[0] as ImageAsset | undefined;
    if (nextImage) {
      await sql`
        UPDATE image_assets
        SET is_primary = true
        WHERE id = ${nextImage.id} AND owner_uid = ${uid}
      `;
    }
  }

  await c.env.IMAGES_BUCKET.delete(image.r2_key);
  return c.body(null, 204);
});

export { router as imagesRouter };
