import { Hono } from 'hono';
import type { Env, HonoVariables, ImageAsset, ImageEntityType } from '../types';
import { ImageListQuerySchema, ImageUploadQuerySchema } from '../types';
import { getDb } from '../lib/db';
import {
  getOwnedItemContext,
  getOwnedMaterialContext,
  getOwnedProjectContext,
  getOwnedRoomContext,
} from '../lib/ownership';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type EntityContext = {
  projectId: string;
  roomId: string | null;
  itemId: string | null;
  materialId: string | null;
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

async function getOwnedEntityContext(
  env: Env,
  entityType: ImageEntityType,
  entityId: string,
  uid: string,
): Promise<EntityContext> {
  if (entityType === 'project') {
    const project = await getOwnedProjectContext(env, entityId, uid);
    return { projectId: project.projectId, roomId: null, itemId: null, materialId: null };
  }

  if (entityType === 'room') {
    const room = await getOwnedRoomContext(env, entityId, uid);
    return { projectId: room.projectId, roomId: room.roomId, itemId: null, materialId: null };
  }

  if (entityType === 'material') {
    const material = await getOwnedMaterialContext(env, entityId, uid);
    return {
      projectId: material.projectId,
      roomId: null,
      itemId: null,
      materialId: material.materialId,
    };
  }

  const item = await getOwnedItemContext(env, entityId, uid);
  return { projectId: item.projectId, roomId: item.roomId, itemId: item.itemId, materialId: null };
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
      AND room_id IS NOT DISTINCT FROM ${context.roomId}
      AND item_id IS NOT DISTINCT FROM ${context.itemId}
      AND material_id IS NOT DISTINCT FROM ${context.materialId}
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
    },
  });

  const sql = getDb(c.env);
  try {
    const rows = await sql`
      WITH demote_existing AS (
        UPDATE image_assets
        SET is_primary = false
        WHERE owner_uid = ${uid}
          AND project_id = ${context.projectId}
          AND room_id IS NOT DISTINCT FROM ${context.roomId}
          AND item_id IS NOT DISTINCT FROM ${context.itemId}
          AND material_id IS NOT DISTINCT FROM ${context.materialId}
      )
      INSERT INTO image_assets (
        id, owner_uid, project_id, room_id, item_id, material_id, r2_key,
        filename, content_type, byte_size, alt_text, is_primary
      )
      VALUES (
        ${imageId},
        ${uid},
        ${context.projectId},
        ${context.roomId},
        ${context.itemId},
        ${context.materialId},
        ${r2Key},
        ${cleanFilename(file.name)},
        ${file.type},
        ${file.size},
        ${parsed.data.alt_text},
        true
      )
      RETURNING *
    `;
    return c.json({ image: imageRow(rows[0]) }, 201);
  } catch (err) {
    await c.env.IMAGES_BUCKET.delete(r2Key).catch(() => undefined);
    throw err;
  }
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
  await c.env.IMAGES_BUCKET.delete(image.r2_key);
  return c.body(null, 204);
});

export { router as imagesRouter };
