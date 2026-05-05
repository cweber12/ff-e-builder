import { Hono } from 'hono';
import type { Env, HonoVariables, ImageAsset, ImageEntityType } from '../types';
import { ImageListQuerySchema, ImageUploadQuerySchema } from '../types';
import { getDb } from '../lib/db';
import {
  getOwnedItemContext,
  getOwnedMaterialContext,
  getOwnedProjectContext,
  getOwnedRoomContext,
  getOwnedProposalItemContext,
} from '../lib/ownership';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type EntityContext = {
  projectId: string;
  roomId: string | null;
  itemId: string | null;
  materialId: string | null;
  proposalItemId: string | null;
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

  if (message.includes('proposal items can have up to 4 swatches')) {
    return 'Proposal items can have up to 4 swatches';
  }

  if (!message.includes('duplicate key value violates unique constraint')) return null;

  if (entityType === 'project') return 'Projects can have only one preview image at a time';
  if (entityType === 'item' || entityType === 'proposal_item') {
    return 'This row already has a rendering';
  }
  if (entityType === 'proposal_plan') return 'This row already has a plan image';
  if (entityType === 'room') return 'This room already has an image';
  if (entityType === 'material') return 'This material already has an image';
  return 'An image already exists for this entity';
}

function isProjectImageAsset(image: ImageAsset): boolean {
  return (
    image.room_id === null &&
    image.item_id === null &&
    image.material_id === null &&
    image.proposal_item_id === null &&
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
      proposalItemId: null,
    };
  }

  if (entityType === 'room') {
    const room = await getOwnedRoomContext(env, entityId, uid);
    return {
      projectId: room.projectId,
      roomId: room.roomId,
      itemId: null,
      materialId: null,
      proposalItemId: null,
    };
  }

  if (entityType === 'material') {
    const material = await getOwnedMaterialContext(env, entityId, uid);
    return {
      projectId: material.projectId,
      roomId: null,
      itemId: null,
      materialId: material.materialId,
      proposalItemId: null,
    };
  }

  if (
    entityType === 'proposal_item' ||
    entityType === 'proposal_swatch' ||
    entityType === 'proposal_plan'
  ) {
    const proposalItem = await getOwnedProposalItemContext(env, entityId, uid);
    return {
      projectId: proposalItem.projectId,
      roomId: null,
      itemId: null,
      materialId: null,
      proposalItemId: proposalItem.proposalItemId,
    };
  }

  const item = await getOwnedItemContext(env, entityId, uid);
  return {
    projectId: item.projectId,
    roomId: item.roomId,
    itemId: item.itemId,
    materialId: null,
    proposalItemId: null,
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
  if (entityType === 'proposal_item') {
    return `${base}/proposal/items/${context.proposalItemId}/${imageId}.${ext}`;
  }
  if (entityType === 'proposal_swatch') {
    return `${base}/proposal/items/${context.proposalItemId}/swatches/${imageId}.${ext}`;
  }
  if (entityType === 'proposal_plan') {
    return `${base}/proposal/items/${context.proposalItemId}/plan/${imageId}.${ext}`;
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
      AND proposal_item_id IS NOT DISTINCT FROM ${context.proposalItemId}
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
      proposalItemId: context.proposalItemId ?? '',
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
          AND proposal_item_id IS NULL
      `;
      const count = (existing[0] as { count?: number } | undefined)?.count ?? 0;
      projectImageCount = count;
      if (count >= 3) {
        await c.env.IMAGES_BUCKET.delete(r2Key).catch(() => undefined);
        return c.json({ error: 'Projects can have up to 3 images' }, 400);
      }
    }
    if (parsed.data.entity_type === 'proposal_swatch') {
      const existing = await sql`
        SELECT COUNT(*)::int AS count
        FROM image_assets
        WHERE owner_uid = ${uid}
          AND project_id = ${context.projectId}
          AND entity_type = 'proposal_swatch'
          AND room_id IS NULL
          AND item_id IS NULL
          AND material_id IS NULL
          AND proposal_item_id IS NOT DISTINCT FROM ${context.proposalItemId}
      `;
      const count = (existing[0] as { count?: number } | undefined)?.count ?? 0;
      if (count >= 4) {
        await c.env.IMAGES_BUCKET.delete(r2Key).catch(() => undefined);
        return c.json({ error: 'Proposal items can have up to 4 swatches' }, 400);
      }
    }

    const isPrimary =
      parsed.data.entity_type === 'project'
        ? projectImageCount === 0
        : parsed.data.entity_type !== 'proposal_swatch';

    if (parsed.data.entity_type === 'project') {
      const rows = await sql`
        INSERT INTO image_assets (
          id, entity_type, owner_uid, project_id, room_id, item_id, material_id, proposal_item_id, r2_key,
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
          ${context.proposalItemId},
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
          AND proposal_item_id IS NOT DISTINCT FROM ${context.proposalItemId}
      )
      INSERT INTO image_assets (
        id, entity_type, owner_uid, project_id, room_id, item_id, material_id, proposal_item_id, r2_key,
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
        ${context.proposalItemId},
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
    if (validationError) {
      const status = validationError === 'Proposal items can have up to 4 swatches' ? 400 : 409;
      return c.json({ error: validationError }, status);
    }
    throw err;
  }
});

router.patch('/:id/crop', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  let image: ImageAsset;
  try {
    image = await getOwnedImage(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const body: unknown = await c.req.json<unknown>().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'Invalid body' }, 400);

  const { crop_x, crop_y, crop_width, crop_height } = body as Record<string, unknown>;
  const clearing =
    crop_x === null && crop_y === null && crop_width === null && crop_height === null;

  if (!clearing) {
    if (
      typeof crop_x !== 'number' ||
      crop_x < 0 ||
      crop_x >= 1 ||
      typeof crop_y !== 'number' ||
      crop_y < 0 ||
      crop_y >= 1 ||
      typeof crop_width !== 'number' ||
      crop_width <= 0 ||
      crop_width > 1 ||
      typeof crop_height !== 'number' ||
      crop_height <= 0 ||
      crop_height > 1
    ) {
      return c.json({ error: 'Invalid crop parameters' }, 400);
    }
  }

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE image_assets
    SET crop_x = ${clearing ? null : (crop_x as number)},
        crop_y = ${clearing ? null : (crop_y as number)},
        crop_width = ${clearing ? null : (crop_width as number)},
        crop_height = ${clearing ? null : (crop_height as number)},
        updated_at = now()
    WHERE id = ${id} AND owner_uid = ${uid}
    RETURNING *
  `;

  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  void image;
  return c.json({ image: imageRow(rows[0]) });
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
        AND proposal_item_id IS NOT DISTINCT FROM ${image.proposal_item_id}
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
        AND proposal_item_id IS NULL
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
